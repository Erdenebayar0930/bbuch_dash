import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, serverError } from "@/lib/api/auth";
import { isRealDate, manageForbidden, requireTaskAccess } from "@/lib/api/taskProgress";
import { db } from "@/lib/db";
import { taskScheduleItems } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TITLE = 255;
const MAX_NOTE = 2000;

/** Даалгаврын хуваарь — эхлэх огноогоор өсөхөөр. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireTaskAccess(request, id);
  if ("error" in access) return access.error;

  try {
    const items = await db
      .select()
      .from(taskScheduleItems)
      .where(eq(taskScheduleItems.taskId, id))
      .orderBy(asc(taskScheduleItems.startDate), asc(taskScheduleItems.createdAt));
    return NextResponse.json({ items, canManage: access.canManage });
  } catch (error) {
    return serverError(error, "Хуваарь уншихад алдаа гарлаа");
  }
}

/** Хуваарийн шинэ үе шат — `{ title, startDate, endDate?, note? }`. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireTaskAccess(request, id);
  if ("error" in access) return access.error;
  if (!access.canManage) return manageForbidden();

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE) : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE) : "";
    const startDate = body.startDate;
    const endDate = body.endDate || body.startDate;

    if (!title) return badRequest("Үе шатын нэрийг бичнэ үү.");
    if (!isRealDate(startDate) || !isRealDate(endDate)) {
      return badRequest("Огноог YYYY-MM-DD хэлбэрээр оруулна уу.");
    }
    if (endDate < startDate) return badRequest("Дуусах огноо эхлэхээс өмнө байж болохгүй.");

    const [item] = await db
      .insert(taskScheduleItems)
      .values({ taskId: id, title, note, startDate, endDate, createdBy: access.caller.uid })
      .returning();

    return NextResponse.json({ item });
  } catch (error) {
    return serverError(error, "Хуваарь нэмэхэд алдаа гарлаа");
  }
}
