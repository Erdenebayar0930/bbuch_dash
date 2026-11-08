import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { readDonationBox } from "@/lib/api/donationBoxInput";
import { db } from "@/lib/db";
import { guardPoints } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/** Харуулын цэгийг засна (зөвхөн админ). */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const parsed = readDonationBox(
      await request.json().catch(() => ({})),
      true,
      "Цэгийн нэрийг оруулна уу."
    );
    if (!parsed.ok) return badRequest(parsed.error);

    if (Object.keys(parsed.value).length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    const [updated] = await db
      .update(guardPoints)
      .set({ ...parsed.value, updatedAt: new Date() })
      .where(eq(guardPoints.id, id))
      .returning();

    if (!updated) return notFound();

    return NextResponse.json({ point: updated });
  } catch (error) {
    return serverError(error, "Цэг засахад алдаа гарлаа");
  }
}

/** Харуулын цэгийг устгана (зөвхөн админ). Эргэлтийн түүх нь дагаж устана. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const deleted = await db
      .delete(guardPoints)
      .where(eq(guardPoints.id, id))
      .returning({ id: guardPoints.id });

    if (deleted.length === 0) return notFound();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Цэг устгахад алдаа гарлаа");
  }
}
