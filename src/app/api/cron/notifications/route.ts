import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { notifyUsers, resolveNotifyTargets } from "@/lib/api/notify";
import { db } from "@/lib/db";
import { scheduledNotifications } from "@/lib/db/schema";

import type { NextRequest } from "next/server";
import type { ScheduledNotificationRow } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Улаанбаатар цагийн бүс — DST байхгүй тул тогтмол UTC+8. */
const UB_OFFSET_MS = 8 * 60 * 60 * 1000;

function ulaanbaatarNow() {
  const now = new Date(Date.now() + UB_OFFSET_MS);
  return {
    date: now.toISOString().slice(0, 10), // YYYY-MM-DD
    time: now.toISOString().slice(11, 16), // HH:mm
    dayOfWeek: now.getUTCDay(), // Date-г UTC+8-аар шилжүүлсэн тул getUTCDay нь бодит гараг
    dayOfMonth: now.getUTCDate(),
  };
}

function isDue(schedule: ScheduledNotificationRow, now: ReturnType<typeof ulaanbaatarNow>) {
  if (!schedule.active) return false;
  if (schedule.lastSentDate === now.date) return false; // Өнөөдөр аль хэдийн явсан
  if (schedule.timeOfDay > now.time) return false; // Цаг нь хараахан болоогүй

  if (schedule.frequency === "weekly") return schedule.dayOfWeek === now.dayOfWeek;
  if (schedule.frequency === "monthly") return schedule.dayOfMonth === now.dayOfMonth;
  return true; // daily
}

/**
 * Гадны cron (жишээ нь cPanel Cron Job) энэ route-ыг тогтмол (15 минут тутам
 * гэх мэт) дуудна. Хэрэглэгчийн нэвтрэлт биш, ЗӨВХӨН нууц түлхүүрээр хамгаална.
 *
 * `CRON_SECRET` тохируулаагүй бол аюулгүй байдлын үүднээс АЛЬ Ч хүсэлтийг
 * татгалзана — env дутуу үед чимээгүй нээлттэй route үлдэхээс сэргийлнэ.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.nextUrl.searchParams.get("secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Эрх хүрэлцэхгүй." }, { status: 403 });
  }

  const now = ulaanbaatarNow();

  try {
    const schedules = await db
      .select()
      .from(scheduledNotifications)
      .where(eq(scheduledNotifications.active, true));

    const due = schedules.filter((schedule) => isDue(schedule, now));
    const results: Array<{ id: string; title: string; recipients: number }> = [];

    for (const schedule of due) {
      const target =
        schedule.targetType === "aimag"
          ? ({ type: "aimag", aimags: schedule.targetValues } as const)
          : schedule.targetType === "role"
            ? ({ type: "role", role: schedule.targetValues[0] ?? "" } as const)
            : ({ type: "all" } as const);

      const uids = await resolveNotifyTargets(target);

      await notifyUsers(
        uids,
        { title: schedule.title, body: schedule.body, url: schedule.url },
        schedule.createdBy ?? undefined
      );

      await db
        .update(scheduledNotifications)
        .set({ lastSentDate: now.date, updatedAt: new Date() })
        .where(and(eq(scheduledNotifications.id, schedule.id)));

      results.push({ id: schedule.id, title: schedule.title, recipients: uids.length });
    }

    return NextResponse.json({ ok: true, checked: schedules.length, sent: results });
  } catch (error) {
    console.error("Тогтмол мэдэгдэл илгээхэд алдаа гарлаа:", error);
    return NextResponse.json({ error: "Дотоод алдаа гарлаа." }, { status: 500 });
  }
}
