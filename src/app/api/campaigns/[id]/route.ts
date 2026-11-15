import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { readCampaign } from "@/lib/api/campaignInput";
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

    const [updated] = await db
      .update(donationCampaigns)
      .set({ ...parsed.value, updatedAt: new Date() })
      .where(eq(donationCampaigns.id, id))
      .returning();

    if (!updated) return notFound();
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
