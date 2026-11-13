import { asc, count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  forbidden,
  requireActiveUser,
  serverError,
} from "@/lib/api/auth";
import { projectVisibility } from "@/lib/api/planAccess";
import { readProject } from "@/lib/api/taskInput";
import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { canManageProjects } from "@/lib/permissions";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Хариунд буцаах багана — хуучин `aimag` баганыг гаргахгүй */
const projectColumns = {
  id: projects.id,
  name: projects.name,
  aimags: projects.aimags,
  description: projects.description,
  position: projects.position,
  archived: projects.archived,
  createdAt: projects.createdAt,
} as const;

/**
 * Төсөл — тухайн хэрэглэгчид харагдах аймгуудынх, даалгаврын тоотой хамт.
 * Харуулын аймаг ба админ бүгдийг харна (`projectVisibility`).
 */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select(projectColumns)
      .from(projects)
      .where(projectVisibility(result.caller.user))
      .orderBy(asc(projects.position), asc(projects.createdAt));

    // Төсөл тус бүрийн нийт ба дуусаагүй даалгаврын тоо — сонголтын жагсаалтад
    const counts = await db
      .select({
        projectId: tasks.projectId,
        total: count(),
        open: sql<number>`sum(case when ${tasks.status} <> 'done' then 1 else 0 end)::int`,
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

/** Шинэ төсөл үүсгэнэ — Харуулын аймаг эсвэл админ. */
export async function POST(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const user = result.caller.user;
  if (!canManageProjects(user?.role, user?.aimags)) {
    return forbidden("Төслийг Харуулын аймаг бүртгэнэ.");
  }

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

    const id = crypto.randomUUID();

    await db.insert(projects).values({
      id,
      name,
      aimags: parsed.value.aimags ?? [],
      description: parsed.value.description ?? "",
      position: next,
      createdBy: result.caller.uid,
    });

    const [created] = await db
      .select(projectColumns)
      .from(projects)
      .where(eq(projects.id, id));

    return NextResponse.json({
      project: { ...created, taskCount: 0, openCount: 0 },
    });
  } catch (error) {
    return serverError(error, "Төсөл үүсгэхэд алдаа гарлаа");
  }
}
