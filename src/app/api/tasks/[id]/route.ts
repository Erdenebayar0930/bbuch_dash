import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  forbidden,
  requireActiveUser,
  serverError,
} from "@/lib/api/auth";
import { notifyUsers } from "@/lib/api/notify";
import { checkTaskTarget, taskColumns } from "@/lib/api/planAccess";
import { readTask } from "@/lib/api/taskInput";
import { db } from "@/lib/db";
import { projects, tasks, users } from "@/lib/db/schema";
import { canManageProjects, canWorkInAimag } from "@/lib/permissions";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


/**
 * Даалгаврыг засна.
 *
 * Харуулын аймаг, админ болон даалгаврын аймгийн гишүүд бүх талбарыг
 * өөрчилнө. Гүйцэтгэгч нь өөрт оногдсон даалгаврынхаа ЗӨВХӨН төлөвийг
 * (канбан багана) сольж чадна — ажлаа хөдөлгөх эрх нь агуулгыг өөрчлөх эрх биш.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const [current] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (!current) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    const user = result.caller.user;
    const canEdit = canWorkInAimag(user?.role, user?.aimags, current.aimag);
    const isAssignee = current.assignedTo === result.caller.uid;

    if (!canEdit && !isAssignee) {
      return forbidden("Зөвхөн тухайн аймгийн гишүүн эсвэл гүйцэтгэгч өөрчилнө.");
    }

    const parsed = await readTask(await request.json().catch(() => ({})), true);
    if (!parsed.ok) return badRequest(parsed.error);

    const patch = parsed.value;
    const keys = Object.keys(patch);

    if (keys.length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    if (!canEdit && keys.some((key) => key !== "status")) {
      return forbidden("Гүйцэтгэгч зөвхөн төлөвийг өөрчилж чадна.");
    }

    // Төсөл, аймаг, гүйцэтгэгч солигдвол шинэ байрлалыг бүхэлд нь шалгана —
    // өөр аймгийн нэр барих, харагдахгүй төсөл рүү зөөхөөс сэргийлнэ
    if (
      patch.projectId !== undefined ||
      patch.aimag !== undefined ||
      patch.assignedTo !== undefined
    ) {
      const denied = await checkTaskTarget(user, {
        projectId: patch.projectId ?? current.projectId,
        aimag: patch.aimag ?? current.aimag,
        assignedTo:
          patch.assignedTo !== undefined ? patch.assignedTo : current.assignedTo,
      });
      if (denied) return badRequest(denied);
    }

    const nextStatus = patch.status ?? current.status;
    const nextProjectId = patch.projectId ?? current.projectId;
    const moved =
      nextStatus !== current.status || nextProjectId !== current.projectId;

    // Өөр багана / төсөл рүү зөөвөл сүүлд нь тавина
    let position = current.position;
    if (moved) {
      const [{ next }] = await db
        .select({ next: sql<number>`coalesce(max(${tasks.position}), -1) + 1` })
        .from(tasks)
        .where(
          and(eq(tasks.projectId, nextProjectId), eq(tasks.status, nextStatus))
        );
      position = next;
    }

    await db
      .update(tasks)
      .set({
        ...patch,
        position,
        // Дууссан төлөвөөс буцаавал гүйцэтгэсэн хугацаа хүчингүй болно
        completedAt:
          nextStatus === "done"
            ? current.completedAt ?? new Date()
            : null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id));

    const [row] = await db
      .select(taskColumns)
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedTo, users.uid))
      .where(eq(tasks.id, id))
      .limit(1);

    // Шинэ гүйцэтгэгч томилогдсон бол мэдэгдэнэ
    if (
      patch.assignedTo !== undefined &&
      row.assignedTo &&
      row.assignedTo !== current.assignedTo &&
      row.assignedTo !== result.caller.uid
    ) {
      await notifyUsers(
        [row.assignedTo],
        {
          title: "Танд ажлын даалгавар оногдлоо",
          body: `${row.projectName}: ${row.title}`,
          url: row.aimag ? `/aimag/${row.aimag}/plan` : "/aimag/guard/plan",
        },
        result.caller.uid
      );
    }

    return NextResponse.json({ task: row });
  } catch (error) {
    return serverError(error, "Даалгавар засахад алдаа гарлаа");
  }
}

/**
 * Даалгаврыг устгана — Харуулын аймаг, админ, эсвэл үүсгэсэн хүн өөрөө
 * (тухайн аймагт харьяалагдсан хэвээр бол).
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const [existing] = await db
      .select({ aimag: tasks.aimag, createdBy: tasks.createdBy })
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    const user = result.caller.user;
    const allowed =
      canManageProjects(user?.role, user?.aimags) ||
      (existing.createdBy === result.caller.uid &&
        canWorkInAimag(user?.role, user?.aimags, existing.aimag));

    if (!allowed) {
      return forbidden("Даалгаврыг үүсгэсэн хүн эсвэл Харуулын аймаг устгана.");
    }

    await db.delete(tasks).where(eq(tasks.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Даалгавар устгахад алдаа гарлаа");
  }
}
