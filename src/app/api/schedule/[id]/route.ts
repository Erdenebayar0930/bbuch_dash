import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  forbidden,
  isAdminRole,
  requireAdmin,
  requireAimag,
  serverError,
} from "@/lib/api/auth";
import { assigneeJoin, shiftColumns } from "@/lib/api/schedule";
import { readScheduleShift } from "@/lib/api/scheduleInput";
import { db } from "@/lib/db";
import { scheduleShifts, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Мод услах ба Дулаанхаан нь Агуу захирамжийн аймгийн хариуцлага */
const AIMAG = "commission";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/**
 * Ээлжийг засна.
 *
 * Админ бүх талбарыг өөрчилнө. Хариуцагч нь ЗӨВХӨН өөрийн ээлжийг гүйцэтгэсэн
 * гэж тэмдэглэж чадна — ингэснээр хуваарь дур мэдэн өөрчлөгдөхгүй ч
 * гүйцэтгэлээ өөрөө бүртгэх боломж үлдэнэ.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAimag(request, AIMAG);
  if ("error" in result) return result.error;

  const { id } = await context.params;
  const isAdmin = isAdminRole(result.caller.user?.role);

  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const [existing] = await db
      .select()
      .from(scheduleShifts)
      .where(eq(scheduleShifts.id, id))
      .limit(1);

    if (!existing) return notFound();

    // Гүйцэтгэлийн тэмдэглэгээ — админ ба хариуцагч хоёулаа хийж болно
    const patch: Record<string, unknown> = {};

    if (body.done !== undefined) {
      if (typeof body.done !== "boolean") {
        return badRequest("done нь true/false байх ёстой.");
      }
      if (!isAdmin && existing.assignedTo !== result.caller.uid) {
        return forbidden("Зөвхөн өөрийн ээлжийг тэмдэглэнэ.");
      }

      patch.doneAt = body.done ? new Date() : null;
      patch.doneBy = body.done ? result.caller.uid : null;
    }

    // Үлдсэн талбарууд нь зөвхөн админы эрх. `kind` нь мөрийн харьяаллыг
    // тодорхойлдог тул засварт огт оролцохгүй.
    const rest = { ...body };
    delete rest.done;
    delete rest.kind;

    if (Object.keys(rest).length > 0) {
      if (!isAdmin) return forbidden("Хуваарийг зөвхөн админ өөрчилнө.");

      const parsed = await readScheduleShift(rest, true);
      if (!parsed.ok) return badRequest(parsed.error);
      Object.assign(patch, parsed.value);
    }

    if (Object.keys(patch).length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    await db
      .update(scheduleShifts)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(scheduleShifts.id, id));

    const [row] = await db
      .select(shiftColumns)
      .from(scheduleShifts)
      .leftJoin(users, assigneeJoin)
      .where(eq(scheduleShifts.id, id))
      .limit(1);

    return NextResponse.json({ shift: row });
  } catch (error) {
    return serverError(error, "Ээлж засахад алдаа гарлаа");
  }
}

/** Ээлжийг устгана (зөвхөн админ). */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const [deleted] = await db
      .delete(scheduleShifts)
      .where(eq(scheduleShifts.id, id))
      .returning({ id: scheduleShifts.id });

    if (!deleted) return notFound();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Ээлж устгахад алдаа гарлаа");
  }
}