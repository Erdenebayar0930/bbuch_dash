import { asc, desc, eq } from "drizzle-orm";
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

/** Тогтмол мэдэгдлийн жагсаалт — мэдэгдэл илгээх эрхтэй хэн ч уншина. */
export async function GET(request: NextRequest) {
  const result = await requireNotifier(request);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select()
      .from(scheduledNotifications)
      .orderBy(desc(scheduledNotifications.active), asc(scheduledNotifications.timeOfDay));

    return NextResponse.json({ schedules: rows });
  } catch (error) {
    return serverError(error, "Тогтмол мэдэгдэл уншихад алдаа гарлаа");
  }
}

/** Шинэ тогтмол мэдэгдэл үүсгэнэ. */
export async function POST(request: NextRequest) {
  const result = await requireNotifier(request);
  if ("error" in result) return result.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const bodyText = typeof body.body === "string" ? body.body.trim() : "";
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const targetType = typeof body.targetType === "string" ? body.targetType : "";
    const targetValues = Array.isArray(body.targetValues)
      ? body.targetValues.filter((v): v is string => typeof v === "string")
      : [];
    const frequency = typeof body.frequency === "string" ? body.frequency : "";
    const timeOfDay = typeof body.timeOfDay === "string" ? body.timeOfDay : "";
    const dayOfWeek = typeof body.dayOfWeek === "number" ? body.dayOfWeek : -1;
    const dayOfMonth = typeof body.dayOfMonth === "number" ? body.dayOfMonth : -1;

    if (!title) return badRequest("Гарчгийг оруулна уу.");
    if (title.length > 255) return badRequest("Гарчиг 255 тэмдэгтээс урт байж болохгүй.");
    if (!bodyText) return badRequest("Агуулгыг оруулна уу.");
    if (!frequencies.has(frequency)) {
      return badRequest('frequency нь "daily", "weekly" эсвэл "monthly" байна.');
    }
    if (!TIME_RE.test(timeOfDay)) {
      return badRequest("timeOfDay нь HH:mm хэлбэртэй байна.");
    }
    if (targetType !== "all" && targetType !== "aimag" && targetType !== "role") {
      return badRequest('targetType нь "all", "aimag" эсвэл "role" байна.');
    }
    if (
      targetType === "aimag" &&
      (targetValues.length === 0 || !targetValues.every((v) => isValidOption(aimags, v)))
    ) {
      return badRequest("Дор хаяж нэг зөв аймаг сонгоно уу.");
    }
    if (
      targetType === "role" &&
      (targetValues.length !== 1 || !["super", "admin", "user"].includes(targetValues[0]))
    ) {
      return badRequest("role утга буруу байна.");
    }
    if (frequency === "weekly" && (dayOfWeek < 0 || dayOfWeek > 6)) {
      return badRequest("weekly давтамжид dayOfWeek (0-6) шаардлагатай.");
    }
    if (frequency === "monthly" && (dayOfMonth < 1 || dayOfMonth > 28)) {
      return badRequest("monthly давтамжид dayOfMonth (1-28) шаардлагатай.");
    }

    // Админ бус (canNotify эрхтэй) хэрэглэгч бүх хэрэглэгч рүү эсвэл эрхийн
    // бүлгээр (role) тохируулж чадахгүй — зөвхөн тодорхой аймаг руу.
    if (!isAdminRole(result.caller.user?.role) && targetType !== "aimag") {
      return forbidden("Зөвхөн тодорхой аймаг руу тогтмол мэдэгдэл тохируулах боломжтой.");
    }

    const id = crypto.randomUUID();

    await db.insert(scheduledNotifications).values({
      id,
      title,
      body: bodyText,
      url,
      targetType,
      targetValues: targetType === "all" ? [] : targetValues,
      frequency,
      timeOfDay,
      dayOfWeek: frequency === "weekly" ? dayOfWeek : -1,
      dayOfMonth: frequency === "monthly" ? dayOfMonth : -1,
      createdBy: result.caller.uid,
    });

    const [created] = await db
      .select()
      .from(scheduledNotifications)
      .where(eq(scheduledNotifications.id, id));

    return NextResponse.json({ schedule: created });
  } catch (error) {
    return serverError(error, "Тогтмол мэдэгдэл үүсгэхэд алдаа гарлаа");
  }
}
