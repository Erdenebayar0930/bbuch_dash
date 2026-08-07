import { and, asc, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireActiveUser,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import { notifyUsers } from "@/lib/api/notify";
import { readTask } from "@/lib/api/taskInput";
import { db } from "@/lib/db";
import { projects, tasks, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Жагсаалтад хэрэгтэй багануудыг нэг дор — GET ба POST хоёул ашиглана */
const taskColumns = {
  id: tasks.id,
  projectId: tasks.projectId,
  projectName: projects.name,
  projectAimag: projects.aimag,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  assignedTo: tasks.assignedTo,
  assigneeFirstName: users.firstName,
  assigneeLastName: users.lastName,
  assigneePhotoUrl: users.photoUrl,
  dueDate: tasks.dueDate,
  position: tasks.position,
  completedAt: tasks.completedAt,
  createdAt: tasks.createdAt,
} as const;

/**
 * Ажлын даалгаврууд.
 *
 * `?projectId=` — нэг төслийн, `?mine=1` — зөвхөн өөрт оногдсон.
 * Уншихыг бүх идэвхтэй хэрэглэгчид зөвшөөрнө: даалгавар нь нийтийн ажлын
 * хуваарь тул хэн юу хийж байгааг бүгд харах ёстой.
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

/** Шинэ даалгавар үүсгэж хэрэглэгчид ононо (зөвхөн админ). */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const parsed = await readTask(await request.json().catch(() => ({})), false);
    if (!parsed.ok) return badRequest(parsed.error);

    const projectId = parsed.value.projectId as string;
    const status = parsed.value.status ?? "todo";

    // Шинэ карт баганынхаа сүүлд орно
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${tasks.position}), -1) + 1` })
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.status, status)));

    const [created] = await db
      .insert(tasks)
      .values({
        ...parsed.value,
        projectId,
        title: parsed.value.title as string,
        status,
        position: next,
        completedAt: status === "done" ? new Date() : null,
        createdBy: result.caller.uid,
      })
      .returning({ id: tasks.id });

    const [row] = await db
      .select(taskColumns)
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedTo, users.uid))
      .where(eq(tasks.id, created.id))
      .limit(1);

    // Оноогдсон хүнд шууд мэдэгдэнэ — өөрөө өөртөө оновол мэдэгдэх шаардлагагүй
    if (row.assignedTo && row.assignedTo !== result.caller.uid) {
      await notifyUsers(
        [row.assignedTo],
        {
          title: "Шинэ ажлын даалгавар",
          body: `${row.projectName}: ${row.title}`,
          url: "/tasks",
        },
        result.caller.uid
      );
    }

    return NextResponse.json({ task: row });
  } catch (error) {
    return serverError(error, "Даалгавар үүсгэхэд алдаа гарлаа");
  }
}
