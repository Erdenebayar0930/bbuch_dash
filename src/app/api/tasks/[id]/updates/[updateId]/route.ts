import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { forbidden, serverError } from "@/lib/api/auth";
import { isUuid, notFound, requireTaskAccess } from "@/lib/api/taskProgress";
import { db } from "@/lib/db";
import { taskUpdates } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Явцын мэдээллийг устгана — бичсэн хүн эсвэл админ. Файлыг клиент цэвэрлэнэ. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; updateId: string }> }
) {
  const { id, updateId } = await context.params;
  const access = await requireTaskAccess(request, id);
  if ("error" in access) return access.error;
  if (!isUuid(updateId)) return notFound();

  try {
    const [existing] = await db
      .select({ authorUid: taskUpdates.authorUid })
      .from(taskUpdates)
      .where(and(eq(taskUpdates.id, updateId), eq(taskUpdates.taskId, id)))
      .limit(1);

    if (!existing) return notFound();
    if (existing.authorUid !== access.caller.uid && !access.isAdmin) {
      return forbidden("Зөвхөн өөрийн бичсэнээ устгана.");
    }

    await db.delete(taskUpdates).where(eq(taskUpdates.id, updateId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Устгахад алдаа гарлаа");
  }
}
