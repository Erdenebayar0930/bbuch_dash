import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, forbidden, requireActiveUser, serverError } from "@/lib/api/auth";
import {
  announceCampaign,
  canApprove,
  notifyChangesRequested,
  readApprovers,
} from "@/lib/api/campaignReview";
import { currentPeriod } from "@/lib/api/campaignRollover";
import { db } from "@/lib/db";
import { donationCampaigns } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Хандивыг хянана — `{ action: "approve" }` эсвэл
 * `{ action: "changes", note }`. Зөвхөн зөвшөөрөгч (сонгоогүй бол админ).
 *
 * Зөвшөөрөхөд анх удаа бол бүх гишүүнд «Шинэ хандив» мэдэгдэл очно.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  if (!canApprove(result.caller, await readApprovers())) {
    return forbidden("Хандив зөвшөөрөх эрхгүй.");
  }

  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action;
    const note = typeof body.note === "string" ? body.note.trim() : "";

    if (action !== "approve" && action !== "changes") {
      return badRequest("action нь approve эсвэл changes байна.");
    }
    if (action === "changes" && !note) {
      return badRequest("Юуг өөрчлөхийг тайлбарт бичнэ үү.");
    }
    if (note.length > 2000) return badRequest("Тайлбар хэт урт байна.");

    const [current] = await db
      .select()
      .from(donationCampaigns)
      .where(eq(donationCampaigns.id, id))
      .limit(1);
    if (!current) return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

    const now = new Date();

    if (action === "changes") {
      const [updated] = await db
        .update(donationCampaigns)
        .set({
          status: "changes",
          reviewNote: note,
          reviewedBy: result.caller.uid,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(donationCampaigns.id, id))
        .returning();

      await notifyChangesRequested(updated, result.caller.uid);
      return NextResponse.json({ campaign: updated });
    }

    // Анх зөвшөөрөгдөж буй бол зарлана; засварын дараах дахин зөвшөөрөлд давтахгүй
    const announce = !current.announcedAt && current.active;
    const [updated] = await db
      .update(donationCampaigns)
      .set({
        status: "approved",
        reviewNote: "",
        reviewedBy: result.caller.uid,
        reviewedAt: now,
        updatedAt: now,
        ...(announce ? { announcedAt: now } : {}),
        // Зарласан мэдэгдэл энэ сарын сануулгыг орлоно
        ...(announce && current.kind === "monthly" ? { lastNotifiedPeriod: currentPeriod() } : {}),
      })
      .where(eq(donationCampaigns.id, id))
      .returning();

    if (announce) await announceCampaign(updated, result.caller.uid);
    return NextResponse.json({ campaign: updated });
  } catch (error) {
    return serverError(error, "Хандив хянахад алдаа гарлаа");
  }
}
