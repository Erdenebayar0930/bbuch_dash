import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  forbidden,
  isAdminRole,
  requireActiveUser,
  serverError,
} from "@/lib/api/auth";
import { CONTENT_FIELDS, readCampaign } from "@/lib/api/campaignInput";
import { announceCampaign, campaignAudience, notifyApprovers } from "@/lib/api/campaignReview";
import { currentPeriod } from "@/lib/api/campaignRollover";
import { db } from "@/lib/db";
import { donationCampaigns } from "@/lib/db/schema";

import type { Caller } from "@/lib/api/auth";
import type { DonationCampaignRow } from "@/lib/db/schema";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/** Админ эсвэл тухайн хандивыг зарласан хүн */
const canManage = (caller: Caller, campaign: DonationCampaignRow) =>
  isAdminRole(caller.user?.role) || (!!campaign.createdBy && campaign.createdBy === caller.uid);

/**
 * Аяныг засна, хаана (`active: false`) эсвэл дахин нээнэ — админ эсвэл
 * зарласан хүн. Онцлох, эрэмбийг зөвхөн админ өөрчилнө.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const parsed = readCampaign(await request.json().catch(() => ({})), true);
    if (!parsed.ok) return badRequest(parsed.error);
    if (!isAdminRole(result.caller.user?.role)) {
      // Маягт эдгээрийг ижил утгаар нь буцааж илгээдэг тул алдаа биш, үл тооно
      delete parsed.value.position;
      delete parsed.value.featured;
    }
    if (Object.keys(parsed.value).length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    // Төрөл солигдвол сарын хугацааг тааруулна: сар бүрийнх болбол одоогийн
    // сараас эхэлж цуврал болно, нэг удаагийнх болбол сар хамаарахгүй
    const patch: Partial<typeof donationCampaigns.$inferInsert> = { ...parsed.value };

    const [current] = await db
      .select()
      .from(donationCampaigns)
      .where(eq(donationCampaigns.id, id))
      .limit(1);
    if (!current) return notFound();
    if (!canManage(result.caller, current)) {
      return forbidden("Зөвхөн өөрийн зарласан хандивыг засна.");
    }
    if (current.board === "alms" && parsed.value.kind === "monthly") {
      return badRequest("Өглөг нь нэг удаагийнх байна.");
    }

    // Гишүүдэд харагдах агуулга өөрчлөгдвөл дахин зөвшөөрөл хүлээнэ
    const contentChanged = CONTENT_FIELDS.some(
      (field) => field in parsed.value && parsed.value[field] !== current[field]
    );
    const needsReview = contentChanged && current.status !== "pending";
    if (needsReview) patch.status = "pending";

    // Зарлагдсан хандивын хүрээ тэлбэл шинээр орсон хүмүүст л мэдэгдэнэ
    const audienceChanged =
      parsed.value.aimags !== undefined &&
      JSON.stringify(parsed.value.aimags) !== JSON.stringify(current.aimags);
    const newcomers =
      audienceChanged && !needsReview && current.status === "approved" && current.active
        ? await (async () => {
            const before = new Set(await campaignAudience(current.aimags));
            return (await campaignAudience(parsed.value.aimags ?? [])).filter(
              (uid) => !before.has(uid)
            );
          })()
        : [];

    if (parsed.value.kind === "monthly") {
      if (!current.period) {
        patch.period = currentPeriod();
        patch.seriesId = current.seriesId ?? id;
        patch.endsOn = "";
      }
    } else if (parsed.value.kind === "once") {
      patch.period = "";
      patch.seriesId = null;
    }

    const [updated] = await db
      .update(donationCampaigns)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(donationCampaigns.id, id))
      .returning();

    if (!updated) return notFound();
    if (needsReview) await notifyApprovers(updated, true);
    if (newcomers.length > 0) await announceCampaign(updated, result.caller.uid, newcomers);
    return NextResponse.json({ campaign: updated });
  } catch (error) {
    return serverError(error, "Хандив засахад алдаа гарлаа");
  }
}

/**
 * Аяныг устгана — админ, эсвэл зарласан хүн зөвшөөрөгдөхөөс өмнө. Зөвшөөрөгдсөн
 * (гишүүдэд зарлагдсан) хандивыг зарласан хүн хаана, устгахгүй.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const [current] = await db
      .select()
      .from(donationCampaigns)
      .where(eq(donationCampaigns.id, id))
      .limit(1);
    if (!current) return notFound();
    if (!isAdminRole(result.caller.user?.role)) {
      if (!canManage(result.caller, current)) {
        return forbidden("Зөвхөн өөрийн зарласан хандивыг устгана.");
      }
      if (current.status === "approved") {
        return forbidden("Зарлагдсан хандивыг устгахгүй — хаана уу.");
      }
    }

    const deleted = await db
      .delete(donationCampaigns)
      .where(eq(donationCampaigns.id, id))
      .returning({ id: donationCampaigns.id });

    if (deleted.length === 0) return notFound();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Хандив устгахад алдаа гарлаа");
  }
}
