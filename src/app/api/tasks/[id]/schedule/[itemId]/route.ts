import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, serverError } from "@/lib/api/auth";
import { isUuid, manageForbidden, notFound, requireTaskAccess } from "@/lib/api/taskProgress";
import { db } from "@/lib/db";
import { taskScheduleItems } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; itemId: string }> };

const match = (id: string, itemId: string) =>
  and(eq(taskScheduleItems.id, itemId), eq(taskScheduleItems.taskId, id));

/** Үе шатыг хийгдсэн/хийгдээгүй болгоно — `{ done: boolean }`. */
export async function PATCH(request: NextRequest, context: Context) {
  const { id, itemId } = await context.params;
  const access = await requireTaskAccess(request, id);
  if ("error" in access) return access.error;
  if (!access.canManage) return manageForbidden();
  if (!isUuid(itemId)) return notFound();

  try {
    const body = (await request.json().catch(() => ({}))) as { done?: unknown };
    if (typeof body.done !== "boolean") return badRequest("done нь true/false байх ёстой.");

    const [item] = await db
      .update(taskScheduleItems)
      .set({ doneAt: body.done ? new Date() : null })
      .where(match(id, itemId))
      .returning();

    if (!item) return notFound();
    return NextResponse.json({ item });
  } catch (error) {
    return serverError(error, "Хуваарь засахад алдаа гарлаа");
  }
}

/** Үе шатыг устгана. */
export async function DELETE(request: NextRequest, context: Context) {
  const { id, itemId } = await context.params;
  const access = await requireTaskAccess(request, id);
  if ("error" in access) return access.error;
  if (!access.canManage) return manageForbidden();
  if (!isUuid(itemId)) return notFound();

  try {
    const deleted = await db
      .delete(taskScheduleItems)
      .where(match(id, itemId))
      .returning({ id: taskScheduleItems.id });

    if (deleted.length === 0) return notFound();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Хуваарь устгахад алдаа гарлаа");
  }
}
