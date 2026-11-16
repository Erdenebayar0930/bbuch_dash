import "server-only";

import { and, eq, lt, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { donationCampaigns } from "@/lib/db/schema";

/** Улаанбаатарын одоогийн сар, YYYY-MM */
export const currentPeriod = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());

/**
 * Сар бүрийн хандивыг шинэ сар руу шилжүүлнэ.
 *
 * Нээлттэй сар бүрийн хандивын `period` нь одоогийн сараас өмнөх бол тэр нь
 * «Дууссан» болж (`active = false`), ижил тохиргоотой одоогийн сарынх шинээр
 * нээгдэнэ. Cron шаардахгүй — жагсаалт уншигдах бүрд дуудагдана. `seriesId +
 * period` дээрх unique индекс нь зэрэг хүсэлт давхар мөр үүсгэхээс хамгаална.
 */
export async function rollOverMonthlyCampaigns(): Promise<void> {
  const period = currentPeriod();

  const stale = await db
    .select()
    .from(donationCampaigns)
    .where(
      and(
        eq(donationCampaigns.kind, "monthly"),
        eq(donationCampaigns.active, true),
        ne(donationCampaigns.period, ""),
        lt(donationCampaigns.period, period)
      )
    );

  for (const row of stale) {
    await db.transaction(async (tx) => {
      await tx
        .update(donationCampaigns)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(donationCampaigns.id, row.id));

      await tx
        .insert(donationCampaigns)
        .values({
          kind: "monthly",
          title: row.title,
          purpose: row.purpose,
          targetAmount: row.targetAmount,
          memoPrefix: row.memoPrefix,
          // Сар бүрийнх тодорхой өдөр дуусдаггүй — сар нь өөрөө хугацаа
          endsOn: "",
          period,
          seriesId: row.seriesId ?? row.id,
          position: row.position,
          featured: row.featured,
          aimags: row.aimags,
          // Цуврал нэг удаа зөвшөөрөгдсөн бол дараагийн сар дахин хүлээхгүй;
          // зарласан мэдэгдэл ч дахин явахгүй — зөвхөн сарын сануулга
          status: row.status,
          reviewNote: row.reviewNote,
          reviewedBy: row.reviewedBy,
          reviewedAt: row.reviewedAt,
          announcedAt: row.announcedAt,
          notifyDay: row.notifyDay,
          notifyTime: row.notifyTime,
          lastNotifiedPeriod: "",
          active: true,
          createdBy: row.createdBy,
        })
        .onConflictDoNothing({
          target: [donationCampaigns.seriesId, donationCampaigns.period],
        });
    });
  }
}
