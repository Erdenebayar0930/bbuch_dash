import { and, asc, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireActiveUser, serverError } from "@/lib/api/auth";
import { notifyUsers } from "@/lib/api/notify";
import {
  checkTaskTarget,
  taskColumns,
  taskVisibility,
} from "@/lib/api/planAccess";
import { readTask } from "@/lib/api/taskInput";
import { db } from "@/lib/db";
import { projects, tasks, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ажлын даалгаврууд.
 *
 * `?projectId=` — нэг төслийн, `?mine=1` — зөвхөн өөрт оногдсон.
 * Харагдах дүрэм нь `taskVisibility`: Харуул/админ бүгдийг, бусад нь өөрийн
 * аймагт харагдах төслийн өөрийн аймгийн болон ерөнхий даалгаврыг.
 */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const mine = searchParams.get("mine") === "1";

    const filters = [
      projectId ? eq(tasks.projectId, projectId) : undefined,
      mine ? eq(tasks.assignedTo, result.caller.uid) : undefined,
      taskVisibility(result.caller.user),
    ].filter(Boolean);

    const rows = await db
      .select(taskColumns)
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedTo, users.uid))
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(asc(tasks.position), desc(tasks.createdAt));

    return NextResponse.json({ tasks: rows });
  } catch (error) {
    return serverError(error, "Даалгавар уншихад алдаа гарлаа");
  }
}

/**
 * Шинэ даалгавар — тухайн аймгийн гишүүн өөрийн аймагт харагдах төсөл
 * дотор үүсгэнэ. Харуулын аймаг ба админ ямар ч аймагт (эсвэл ерөнхий).
 */
export async function POST(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const parsed = await readTask(await request.json().catch(() => ({})), false);
    if (!parsed.ok) return badRequest(parsed.error);

    const projectId = parsed.value.projectId as string;
    const aimag = parsed.value.aimag ?? "";
    const status = parsed.value.status ?? "todo";

    const denied = await checkTaskTarget(result.caller.user, {
      projectId,
      aimag,
      assignedTo: parsed.value.assignedTo ?? null,
    });
    if (denied) return badRequest(denied);

    // Шинэ карт баганынхаа сүүлд орно
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${tasks.position}), -1) + 1` })
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.status, status)));

    const id = crypto.randomUUID();

    await db.insert(tasks).values({
      ...parsed.value,
      id,
      projectId,
      aimag,
      title: parsed.value.title as string,
      status,
      position: next,
      completedAt: status === "done" ? new Date() : null,
      createdBy: result.caller.uid,
    });

    const [row] = await db
      .select(taskColumns)
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedTo, users.uid))
      .where(eq(tasks.id, id))
      .limit(1);

    // Оноогдсон хүнд шууд мэдэгдэнэ — өөрөө өөртөө оновол мэдэгдэх шаардлагагүй
    if (row.assignedTo && row.assignedTo !== result.caller.uid) {
      await notifyUsers(
        [row.assignedTo],
        {
          title: "Шинэ ажлын даалгавар",
          body: `${row.projectName}: ${row.title}`,
          url: row.aimag ? `/aimag/${row.aimag}/plan` : "/aimag/guard/plan",
        },
        result.caller.uid
      );
    }

    return NextResponse.json({ task: row });
  } catch (error) {
    return serverError(error, "Даалгавар үүсгэхэд алдаа гарлаа");
  }
}
