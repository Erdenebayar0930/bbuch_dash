import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  forbidden,
  requireActiveUser,
  serverError,
} from "@/lib/api/auth";
import {
  depthOf,
  loadProjectTree,
  projectVisibility,
} from "@/lib/api/planAccess";
import { MAX_PROJECT_DEPTH, fitChildAimags } from "@/data/taskOptions";
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
  parentId: projects.parentId,
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

/**
 * Шинэ төсөл эсвэл дэд төсөл (`parentId`) үүсгэнэ — Харуулын аймаг эсвэл
 * админ. Дэд төслийн аймгууд эхийнхээс сонгогдоно (`fitChildAimags`).
 */
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
    const parentId = parsed.value.parentId ?? null;
    let aimags = parsed.value.aimags ?? [];

    if (parentId) {
      const tree = await loadProjectTree();
      const parent = tree.get(parentId);

      if (!parent) return badRequest("Эх төсөл олдсонгүй.");
      if (depthOf(parentId, tree) >= MAX_PROJECT_DEPTH) {
        return badRequest(
          `Дэд төсөл ${MAX_PROJECT_DEPTH} түвшнээс гүн байж болохгүй.`
        );
      }

      const fitted = fitChildAimags(parent.aimags, aimags);
      if (!fitted) {
        return badRequest("Дэд төсөл зөвхөн эх төслийн аймгуудад харагдана.");
      }
      aimags = fitted;
    }

    // Нэр нь нэг эхийн дотор давхардахгүй — өөр төсөлд ижил нэртэй дэд
    // төсөл (жишээ нь "Бэлтгэл") байж болно
    const [duplicate] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.name, name),
          parentId ? eq(projects.parentId, parentId) : isNull(projects.parentId)
        )
      )
      .limit(1);

    if (duplicate) return badRequest(`"${name}" нэртэй төсөл энд аль хэдийн байна.`);

    // Эрэмбийг сүүлд нь тавина — одоо байгаа дараалал өөрчлөгдөхгүй
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${projects.position}), -1) + 1` })
      .from(projects);

    const id = crypto.randomUUID();

    await db.insert(projects).values({
      id,
      name,
      aimags,
      parentId,
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
