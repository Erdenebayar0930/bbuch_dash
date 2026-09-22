import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { aimags, isValidOption } from "@/data/profileOptions";
import { badRequest, forbidden, requireNotifier, serverError } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { scheduledNotifications } from "@/lib/db/schema";
import { isAdminRole } from "@/lib/permissions";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const frequencies = new Set(["daily", "weekly", "monthly"]);
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Идэвхжүүлэх/идэвхгүй болгох, эсвэл тохиргоог засах. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireNotifier(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const [existing] = await db
      .select()
      .from(scheduledNotifications)
      .where(eq(scheduledNotifications.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    // Админ бус хэрэглэгч зөвхөн ӨӨРИЙН үүсгэсэн, аймагт чиглэсэн тохиргоог
    // засна — бусдын эсвэл бүх/бүлгийн тохиргоонд хүрэхгүй.
    const isOwner = existing.createdBy === result.caller.uid;
    if (
      !isAdminRole(result.caller.user?.role) &&
      (!isOwner || existing.targetType !== "aimag")
    ) {
      return forbidden("Энэ тогтмол мэдэгдлийг засах эрхгүй байна.");
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (body.active !== undefined) {
      if (typeof body.active !== "boolean") return badRequest("active нь true/false байна.");
      patch.active = body.active;
    }

    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) return badRequest("Гарчгийг оруулна уу.");
      if (title.length > 255) return badRequest("Гарчиг 255 тэмдэгтээс урт байж болохгүй.");
      patch.title = title;
    }

    if (body.body !== undefined) {
      const text = typeof body.body === "string" ? body.body.trim() : "";
      if (!text) return badRequest("Агуулгыг оруулна уу.");
      patch.body = text;
    }

    if (body.url !== undefined) {
      patch.url = typeof body.url === "string" ? body.url.trim() : "";
    }

    if (body.timeOfDay !== undefined) {
      if (typeof body.timeOfDay !== "string" || !TIME_RE.test(body.timeOfDay)) {
        return badRequest("timeOfDay нь HH:mm хэлбэртэй байна.");
      }
      patch.timeOfDay = body.timeOfDay;
    }

    if (body.frequency !== undefined) {
      if (typeof body.frequency !== "string" || !frequencies.has(body.frequency)) {
        return badRequest('frequency нь "daily", "weekly" эсвэл "monthly" байна.');
      }
      patch.frequency = body.frequency;
    }

    if (body.dayOfWeek !== undefined) {
      if (typeof body.dayOfWeek !== "number" || body.dayOfWeek < 0 || body.dayOfWeek > 6) {
        return badRequest("dayOfWeek нь 0-6 хооронд байна.");
      }
      patch.dayOfWeek = body.dayOfWeek;
    }

    if (body.dayOfMonth !== undefined) {
      if (typeof body.dayOfMonth !== "number" || body.dayOfMonth < 1 || body.dayOfMonth > 28) {
        return badRequest("dayOfMonth нь 1-28 хооронд байна.");
      }
      patch.dayOfMonth = body.dayOfMonth;
    }

    if (body.targetType !== undefined || body.targetValues !== undefined) {
      const targetType = (body.targetType as string) ?? existing.targetType;
      const targetValues = Array.isArray(body.targetValues)
        ? body.targetValues.filter((v): v is string => typeof v === "string")
        : existing.targetValues;

      if (!["all", "aimag", "role"].includes(targetType)) {
        return badRequest('targetType нь "all", "aimag" эсвэл "role" байна.');
      }
      if (!isAdminRole(result.caller.user?.role) && targetType !== "aimag") {
        return forbidden("Зөвхөн тодорхой аймаг руу тогтмол мэдэгдэл тохируулах боломжтой.");
      }
      if (
        targetType === "aimag" &&
        (targetValues.length === 0 || !targetValues.every((v) => isValidOption(aimags, v)))
      ) {
        return badRequest("Дор хаяж нэг зөв аймаг сонгоно уу.");
      }

      patch.targetType = targetType;
      patch.targetValues = targetType === "all" ? [] : targetValues;
    }

    if (Object.keys(patch).length === 1) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    await db
      .update(scheduledNotifications)
      .set(patch)
      .where(eq(scheduledNotifications.id, id));

    const [updated] = await db
      .select()
      .from(scheduledNotifications)
      .where(eq(scheduledNotifications.id, id))
      .limit(1);

    return NextResponse.json({ schedule: updated });
  } catch (error) {
    return serverError(error, "Тогтмол мэдэгдэл шинэчлэхэд алдаа гарлаа");
  }
}

/** Тогтмол мэдэгдлийг устгана. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireNotifier(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const [existing] = await db
      .select({ id: scheduledNotifications.id, createdBy: scheduledNotifications.createdBy })
      .from(scheduledNotifications)
      .where(eq(scheduledNotifications.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    if (!isAdminRole(result.caller.user?.role) && existing.createdBy !== result.caller.uid) {
      return forbidden("Энэ тогтмол мэдэгдлийг устгах эрхгүй байна.");
    }

    await db.delete(scheduledNotifications).where(eq(scheduledNotifications.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Устгахад алдаа гарлаа");
  }
}
