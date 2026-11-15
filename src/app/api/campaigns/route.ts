import { asc, desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireActiveUser,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import { readCampaign } from "@/lib/api/campaignInput";
import { currentPeriod, rollOverMonthlyCampaigns } from "@/lib/api/campaignRollover";
import { db } from "@/lib/db";
import { donationCampaigns } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Хандивын аянууд — нээлттэй ба дууссан бүгд («Дууссан» табд гишүүд ч
 * харна). Өмнөх сарын сар бүрийн хандивыг эхлээд шинэ сар руу шилжүүлнэ.
 * Эрэмбэ: онцлох → админы эрэмбэ → шинэ нь.
 */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    await rollOverMonthlyCampaigns();

    const rows = await db
      .select()
      .from(donationCampaigns)
      .orderBy(
        desc(donationCampaigns.featured),
        asc(donationCampaigns.position),
        desc(donationCampaigns.createdAt)
      );

    return NextResponse.json({ campaigns: rows });
  } catch (error) {
    return serverError(error, "Хандивын мэдээлэл уншихад алдаа гарлаа");
  }
}

/** Шинэ хандивын аян — зөвхөн админ. */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const parsed = readCampaign(await request.json().catch(() => ({})), false);
    if (!parsed.ok) return badRequest(parsed.error);

    const input = parsed.value;
    const monthly = input.kind === "monthly";

    // Шинэ нь жагсаалтын төгсгөлд
    const [{ next }] = await db
      .select({ next: sql<number>`(coalesce(max(${donationCampaigns.position}), -1) + 1)::int` })
      .from(donationCampaigns);

    const id = crypto.randomUUID();
    const [created] = await db
      .insert(donationCampaigns)
      .values({
        position: next,
        ...input,
        id,
        title: input.title as string,
        // Сар бүрийнх одоогийн сараас эхэлж, өөрөө цувралынхаа эх болно
        period: monthly ? currentPeriod() : "",
        seriesId: monthly ? id : null,
        endsOn: monthly ? "" : (input.endsOn ?? ""),
        createdBy: result.caller.uid,
      })
      .returning();

    return NextResponse.json({ campaign: created });
  } catch (error) {
    return serverError(error, "Хандив нэмэхэд алдаа гарлаа");
  }
}
