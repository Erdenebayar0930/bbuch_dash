import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, serverError } from "@/lib/api/auth";
import { notifyUsers } from "@/lib/api/notify";
import {
  TAHILT_COMMANDS_URL,
  checkTahiltPeople,
  commandExists,
  readTahiltTaskRow,
  requireTahilt,
} from "@/lib/api/tahiltPlan";
import { readTask } from "@/lib/api/taskInput";
import { db } from "@/lib/db";
import { tahiltTasks } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/** Даалгаврыг засна — Тахилтын гишүүн эсвэл админ. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireTahilt(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;
  const me = result.caller.uid;

  try {
    const [current] = await db
      .select()
      .from(tahiltTasks)
      .where(eq(tahiltTasks.id, id))
      .limit(1);

    if (!current) return notFound();

    const parsed = await readTask(
      await request.json().catch(() => ({})),
      true,
      commandExists
    );
    if (!parsed.ok) return badRequest(parsed.error);

    // Тахилтын даалгавар аймаггүй — ирсэн `aimags`-ийг алгасна
    const { aimags: _ignored, projectId, ...rest } = parsed.value;
    void _ignored;

    const patch: Partial<typeof tahiltTasks.$inferInsert> = { ...rest };
    if (projectId !== undefined) patch.commandId = projectId;

    if (Object.keys(patch).length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    const currentPartners = current.collaborators ?? [];
    const nextAssignee =
      patch.assignedTo !== undefined ? patch.assignedTo : current.assignedTo;

    if (patch.collaborators !== undefined || patch.assignedTo !== undefined) {
      patch.collaborators = (patch.collaborators ?? currentPartners).filter(
        (uid) => uid !== nextAssignee
      );

      const denied = await checkTahiltPeople(result.caller.user?.role, [
        ...(nextAssignee ? [nextAssignee] : []),
        ...patch.collaborators,
      ]);
      if (denied) return badRequest(denied);
    }

    const nextStatus = patch.status ?? current.status;
    const nextCommandId = patch.commandId ?? current.commandId;
    const moved =
      nextStatus !== current.status || nextCommandId !== current.commandId;

    // Өөр багана / тушаал руу зөөвөл сүүлд нь тавина
    let position = current.position;
    if (moved) {
      const [{ next }] = await db
        .select({ next: sql<number>`coalesce(max(${tahiltTasks.position}), -1) + 1` })
        .from(tahiltTasks)
        .where(
          and(eq(tahiltTasks.commandId, nextCommandId), eq(tahiltTasks.status, nextStatus))
        );
      position = next;
    }

    await db
      .update(tahiltTasks)
      .set({
        ...patch,
        position,
        completedAt: nextStatus === "done" ? (current.completedAt ?? new Date()) : null,
        updatedAt: new Date(),
      })
      .where(eq(tahiltTasks.id, id));

    const row = await readTahiltTaskRow(id);
    if (!row) throw new Error("Засварласан даалгавар олдсонгүй");

    const body = `${row.projectName}: ${row.title}`;
    const url = TAHILT_COMMANDS_URL;

    if (
      patch.assignedTo !== undefined &&
      row.assignedTo &&
      row.assignedTo !== current.assignedTo &&
      row.assignedTo !== me
    ) {
      await notifyUsers(
        [row.assignedTo],
        { title: "Та даалгаврын ерөнхий хариуцагч боллоо", body, url },
        me
      );
    }

    const added = (row.collaborators ?? []).filter(
      (uid) => !currentPartners.includes(uid) && uid !== me
    );
    if (added.length > 0) {
      await notifyUsers(
        added,
        { title: "Таныг даалгаварт хамтрагчаар нэмлээ", body, url },
        me
      );
    }

    return NextResponse.json({ task: row });
  } catch (error) {
    return serverError(error, "Даалгавар засахад алдаа гарлаа");
  }
}

/** Даалгаврыг устгана — Тахилтын гишүүн эсвэл админ. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireTahilt(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const deleted = await db
      .delete(tahiltTasks)
      .where(eq(tahiltTasks.id, id))
      .returning({ id: tahiltTasks.id });

    if (deleted.length === 0) return notFound();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Даалгавар устгахад алдаа гарлаа");
  }
}
