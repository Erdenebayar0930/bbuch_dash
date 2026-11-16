import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { GUARD_AIMAG } from "@/data/guardOptions";
import { badRequest, forbidden, isAdminRole, requireAimag, serverError } from "@/lib/api/auth";
import { GUARD_NOTE_LIMIT, readDonationBox } from "@/lib/api/donationBoxInput";
import { db } from "@/lib/db";
import { guardPoints } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/**
 * Засах/устгах эрх — байршлыг тэмдэглэсэн хүн эсвэл админ.
 * Харуулын аймгийн гишүүн бүр шинээр тэмдэглэж болно (@see ../route.ts POST).
 */
async function authorize(request: NextRequest, id: string) {
  const result = await requireAimag(request, GUARD_AIMAG);
  if ("error" in result) return { error: result.error } as const;

  const [point] = await db
    .select({ createdBy: guardPoints.createdBy, images: guardPoints.images })
    .from(guardPoints)
    .where(eq(guardPoints.id, id))
    .limit(1);
  if (!point) return { error: notFound() } as const;

  const { caller } = result;
  if (point.createdBy !== caller.uid && !isAdminRole(caller.user?.role)) {
    return { error: forbidden("Зөвхөн өөрийн тэмдэглэсэн байршлыг засна.") } as const;
  }
  return { caller, point } as const;
}

/** Байршлыг засна — тэмдэглэсэн хүн эсвэл админ. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const result = await authorize(request, id);
  if ("error" in result) return result.error;

  try {
    const parsed = readDonationBox(
      await request.json().catch(() => ({})),
      true,
      "Байршлын нэрийг оруулна уу.",
      {
        noteLimit: GUARD_NOTE_LIMIT,
        imagesOwner: result.caller.uid,
        // Өмнө нь хавсаргасан (өөр хүний оруулсан ч) зургаа хэвээр үлдээж болно
        keepPaths: (result.point.images ?? []).map((image) => image.path),
      }
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
    return serverError(error, "Байршил засахад алдаа гарлаа");
  }
}

/** Байршлыг устгана — тэмдэглэсэн хүн эсвэл админ. Эргэлтийн түүх нь дагаж устана. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const result = await authorize(request, id);
  if ("error" in result) return result.error;

  try {
    const deleted = await db
      .delete(guardPoints)
      .where(eq(guardPoints.id, id))
      .returning({ id: guardPoints.id, images: guardPoints.images });

    if (deleted.length === 0) return notFound();

    // Зургуудыг клиент цэвэрлэнэ (бусад самбартай ижил)
    return NextResponse.json({ ok: true, images: deleted[0].images ?? [] });
  } catch (error) {
    return serverError(error, "Байршил устгахад алдаа гарлаа");
  }
}
