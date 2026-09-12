import { asc, count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireActiveUser,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import { readProject } from "@/lib/api/taskInput";
import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Бүх төсөл — даалгаврын тоотой хамт. */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select()
      .from(projects)
      .orderBy(asc(projects.position), asc(projects.createdAt));

    // Төсөл тус бүрийн нийт ба дуусаагүй даалгаврын тоо — сонголтын жагсаалтад
    const counts = await db
      .select({
        projectId: tasks.projectId,
        total: count(),
        // Postgres-ийн `count(*) filter (where ...)`-ийг MySQL дэмждэггүй тул
        // нөхцөлт нийлбэрээр орлууллаа.
        open: sql<number>`cast(sum(case when ${tasks.status} <> 'done' then 1 else 0 end) as signed)`,
      })
      .from(tasks)
      .groupBy(tasks.projectId);

    const byProject = new Map(counts.map((row) => [row.projectId, row]));

    return NextResponse.json({
      projects: rows.map((row) => ({
        ...row,
        taskCount: Number(byProject.get(row.id)?.total ?? 0),
        openCount: Number(byProject.get(row.id)?.open ?? 0),
      })),
    });
  } catch (error) {
    return serverError(error, "Төслүүдийг уншихад алдаа гарлаа");
  }
}

/** Шинэ төсөл үүсгэнэ (зөвхөн админ). */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const parsed = readProject(await request.json().catch(() => ({})), false);
    if (!parsed.ok) return badRequest(parsed.error);

    const name = parsed.value.name as string;

    const [duplicate] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.name, name))
      .limit(1);

    if (duplicate) return badRequest(`"${name}" төсөл аль хэдийн бүртгэгдсэн.`);

    // Эрэмбийг сүүлд нь тавина — одоо байгаа дараалал өөрчлөгдөхгүй
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${projects.position}), -1) + 1` })
      .from(projects);

    // MySQL нь INSERT ... RETURNING дэмждэггүй тул ID-г урьдчилж үүсгээд,
    // оруулсны дараа мөрөө буцааж уншина.
    const id = crypto.randomUUID();

    await db.insert(projects).values({
      ...parsed.value,
      id,
      name,
      position: next,
      createdBy: result.caller.uid,
    });

    const [created] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));

    return NextResponse.json({
      project: { ...created, taskCount: 0, openCount: 0 },
    });
  } catch (error) {
    return serverError(error, "Төсөл үүсгэхэд алдаа гарлаа");
  }
}
