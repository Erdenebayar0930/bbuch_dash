import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { CONTENT_FIELDS, readCampaign } from "@/lib/api/campaignInput";
import { announceCampaign, campaignAudience, notifyApprovers } from "@/lib/api/campaignReview";
import { currentPeriod } from "@/lib/api/campaignRollover";
import { db } from "@/lib/db";
import { donationCampaigns } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/** Аяныг засна, хаана (`active: false`) эсвэл дахин нээнэ — зөвхөн админ. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const parsed = readCampaign(await request.json().catch(() => ({})), true);
    if (!parsed.ok) return badRequest(parsed.error);
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

/** Аяныг устгана — зөвхөн админ. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
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
