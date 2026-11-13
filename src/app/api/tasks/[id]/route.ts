import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  forbidden,
  requireActiveUser,
  serverError,
} from "@/lib/api/auth";
import { notifyUsers } from "@/lib/api/notify";
import { checkTaskTarget, planUrl, readTaskRow } from "@/lib/api/planAccess";
import { readTask } from "@/lib/api/taskInput";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { canManageProjects, canWorkInAnyAimag } from "@/lib/permissions";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Даалгаврыг засна.
 *
 * Харуулын аймаг, админ болон даалгаварт оролцох аймгуудын гишүүд бүх
 * талбарыг өөрчилнө. Ерөнхий хариуцагч ба хамтрагчид ЗӨВХӨН төлөвийг
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

    const me = result.caller.uid;
    const user = result.caller.user;
    const currentAimags = current.aimags ?? [];
    const currentPartners = current.collaborators ?? [];

    const canEdit = canWorkInAnyAimag(user?.role, user?.aimags, currentAimags);
    const isInvolved =
      current.assignedTo === me || currentPartners.includes(me);

    if (!canEdit && !isInvolved) {
      return forbidden(
        "Зөвхөн тухайн аймгийн гишүүн, хариуцагч эсвэл хамтрагч өөрчилнө."
      );
    }

    const parsed = await readTask(await request.json().catch(() => ({})), true);
    if (!parsed.ok) return badRequest(parsed.error);

    const patch = parsed.value;
    const keys = Object.keys(patch);

    if (keys.length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    if (!canEdit && keys.some((key) => key !== "status")) {
      return forbidden("Хариуцагч, хамтрагч зөвхөн төлөвийг өөрчилж чадна.");
    }

    const nextAssignee =
      patch.assignedTo !== undefined ? patch.assignedTo : current.assignedTo;
    if (patch.collaborators !== undefined || patch.assignedTo !== undefined) {
      patch.collaborators = (patch.collaborators ?? currentPartners).filter(
        (uid) => uid !== nextAssignee
      );
    }

    // Төсөл, аймаг, хүмүүс солигдвол шинэ байрлалыг бүхэлд нь шалгана —
    // өөр аймгийн нэр барих, харагдахгүй төсөл рүү зөөхөөс сэргийлнэ
    if (
      patch.projectId !== undefined ||
      patch.aimags !== undefined ||
      patch.assignedTo !== undefined ||
      patch.collaborators !== undefined
    ) {
      const denied = await checkTaskTarget(user, {
        projectId: patch.projectId ?? current.projectId,
        aimags: patch.aimags ?? currentAimags,
        assignedTo: nextAssignee,
        collaborators: patch.collaborators ?? currentPartners,
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

    const row = await readTaskRow(id);
    if (!row) throw new Error("Засварласан даалгавар олдсонгүй");

    const url = planUrl(row.aimags);
    const body = `${row.projectName}: ${row.title}`;

    // Шинэ хариуцагч / шинээр нэмэгдсэн хамтрагчдад мэдэгдэнэ
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

/**
 * Даалгаврыг устгана — Харуулын аймаг, админ, эсвэл үүсгэсэн хүн өөрөө
 * (оролцох аймгуудын аль нэгд харьяалагдсан хэвээр бол).
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
      .select({ aimags: tasks.aimags, createdBy: tasks.createdBy })
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
        canWorkInAnyAimag(user?.role, user?.aimags, existing.aimags ?? []));

    if (!allowed) {
      return forbidden("Даалгаврыг үүсгэсэн хүн эсвэл Харуулын аймаг устгана.");
    }

    await db.delete(tasks).where(eq(tasks.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Даалгавар устгахад алдаа гарлаа");
  }
}
