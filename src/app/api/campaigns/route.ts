import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  isAdminRole,
  requireActiveUser,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import { readCampaign } from "@/lib/api/campaignInput";
import { db } from "@/lib/db";
import { donationCampaigns } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Хандивын аянууд. Гишүүд зөвхөн нээлттэйг, админ дууссаныг ч харна
 * (дахин нээх, засахад).
 */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const isAdmin = isAdminRole(result.caller.user?.role);

  try {
    const rows = await db
      .select()
      .from(donationCampaigns)
      .where(isAdmin ? undefined : eq(donationCampaigns.active, true))
      .orderBy(desc(donationCampaigns.active), desc(donationCampaigns.createdAt));

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
    const [created] = await db
      .insert(donationCampaigns)
      .values({
        ...input,
        title: input.title as string,
        createdBy: result.caller.uid,
      })
      .returning();

    return NextResponse.json({ campaign: created });
  } catch (error) {
    return serverError(error, "Хандив нэмэхэд алдаа гарлаа");
  }
}
