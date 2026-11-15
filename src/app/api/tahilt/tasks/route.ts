import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, serverError } from "@/lib/api/auth";
import { notifyUsers } from "@/lib/api/notify";
import {
  TAHILT_COMMANDS_URL,
  asTaskRows,
  checkTahiltPeople,
  commandExists,
  readTahiltTaskRow,
  requireTahilt,
  tahiltTaskColumns,
} from "@/lib/api/tahiltPlan";
import { readTask } from "@/lib/api/taskInput";
import { db } from "@/lib/db";
import { tahiltCommands, tahiltTasks, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Тахилтын даалгаврууд. `?projectId=` — нэг тушаалын, `?mine=1` — өөрөө
 * хариуцагч эсвэл хамтрагч. Тахилтын гишүүн эсвэл админ.
 */
export async function GET(request: NextRequest) {
  const result = await requireTahilt(request);
  if ("error" in result) return result.error;

  try {
    const { searchParams } = new URL(request.url);
    const commandId = searchParams.get("projectId");
    const mine = searchParams.get("mine") === "1";
    const me = result.caller.uid;

    const filters = [
      commandId ? eq(tahiltTasks.commandId, commandId) : undefined,
      mine
        ? or(
            eq(tahiltTasks.assignedTo, me),
            sql`${tahiltTasks.collaborators} @> ${JSON.stringify([me])}::jsonb`
          )
        : undefined,
    ].filter(Boolean);

    const rows = await db
      .select(tahiltTaskColumns)
      .from(tahiltTasks)
      .innerJoin(tahiltCommands, eq(tahiltTasks.commandId, tahiltCommands.id))
      .leftJoin(users, eq(tahiltTasks.assignedTo, users.uid))
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(asc(tahiltTasks.position), desc(tahiltTasks.createdAt));

    return NextResponse.json({ tasks: await asTaskRows(rows) });
  } catch (error) {
    return serverError(error, "Даалгавар уншихад алдаа гарлаа");
  }
}

/** Шинэ даалгавар — Тахилтын гишүүн эсвэл админ. */
export async function POST(request: NextRequest) {
  const result = await requireTahilt(request);
  if ("error" in result) return result.error;

  const me = result.caller.uid;

  try {
    const parsed = await readTask(
      await request.json().catch(() => ({})),
      false,
      commandExists
    );
    if (!parsed.ok) return badRequest(parsed.error);

    const commandId = parsed.value.projectId as string;
    const assignedTo = parsed.value.assignedTo ?? null;
    const collaborators = (parsed.value.collaborators ?? []).filter(
      (uid) => uid !== assignedTo
    );
    const status = parsed.value.status ?? "todo";

    const denied = await checkTahiltPeople(result.caller.user?.role, [
      ...(assignedTo ? [assignedTo] : []),
      ...collaborators,
    ]);
    if (denied) return badRequest(denied);

    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${tahiltTasks.position}), -1) + 1` })
      .from(tahiltTasks)
      .where(and(eq(tahiltTasks.commandId, commandId), eq(tahiltTasks.status, status)));

    const [created] = await db
      .insert(tahiltTasks)
      .values({
        commandId,
        title: parsed.value.title as string,
        description: parsed.value.description ?? "",
        priority: parsed.value.priority ?? "normal",
        dueDate: parsed.value.dueDate ?? "",
        assignedTo,
        collaborators,
        status,
        position: next,
        completedAt: status === "done" ? new Date() : null,
        createdBy: me,
      })
      .returning({ id: tahiltTasks.id });

    const row = await readTahiltTaskRow(created.id);
    if (!row) throw new Error("Үүсгэсэн даалгавар олдсонгүй");

    const body = `${row.projectName}: ${row.title}`;
    const url = TAHILT_COMMANDS_URL;

    if (row.assignedTo && row.assignedTo !== me) {
      await notifyUsers(
        [row.assignedTo],
        { title: "Та даалгаврын ерөнхий хариуцагч боллоо", body, url },
        me
      );
    }
    const partners = collaborators.filter((uid) => uid !== me);
    if (partners.length > 0) {
      await notifyUsers(
        partners,
        { title: "Таныг даалгаварт хамтрагчаар нэмлээ", body, url },
        me
      );
    }

    return NextResponse.json({ task: row });
  } catch (error) {
    return serverError(error, "Даалгавар үүсгэхэд алдаа гарлаа");
  }
}
