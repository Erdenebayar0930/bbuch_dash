import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { readDonationBox } from "@/lib/api/donationBoxInput";
import { db } from "@/lib/db";
import { donationBoxes } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/** Байршлыг засна (зөвхөн админ). */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const parsed = readDonationBox(await request.json().catch(() => ({})), true);
    if (!parsed.ok) return badRequest(parsed.error);

    if (Object.keys(parsed.value).length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    // MySQL нь UPDATE ... RETURNING дэмждэггүй — засаад буцааж уншина
    await db
      .update(donationBoxes)
      .set({ ...parsed.value, updatedAt: new Date() })
      .where(eq(donationBoxes.id, id));

    const [updated] = await db
      .select()
      .from(donationBoxes)
      .where(eq(donationBoxes.id, id))
      .limit(1);

    if (!updated) return notFound();

    return NextResponse.json({ box: updated });
  } catch (error) {
    return serverError(error, "Байршил засахад алдаа гарлаа");
  }
}

/** Байршлыг устгана (зөвхөн админ). */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    // MySQL нь DELETE ... RETURNING дэмждэггүй — эхлээд байгаа эсэхийг шалгана
    const [existing] = await db
      .select({ id: donationBoxes.id })
      .from(donationBoxes)
      .where(eq(donationBoxes.id, id))
      .limit(1);

    if (!existing) return notFound();

    await db.delete(donationBoxes).where(eq(donationBoxes.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Байршил устгахад алдаа гарлаа");
  }
}