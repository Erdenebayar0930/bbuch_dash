import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import { readWelfareHousehold } from "@/lib/api/welfareInput";
import { db } from "@/lib/db";
import { welfareHouseholds } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/** Өрхийн мэдээллийг засна (зөвхөн админ). */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const parsed = readWelfareHousehold(
      await request.json().catch(() => ({})),
      true
    );
    if (!parsed.ok) return badRequest(parsed.error);

    if (Object.keys(parsed.value).length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    // MySQL нь UPDATE ... RETURNING дэмждэггүй — засаад буцааж уншина
    await db
      .update(welfareHouseholds)
      .set({ ...parsed.value, updatedAt: new Date() })
      .where(eq(welfareHouseholds.id, id));

    const [updated] = await db
      .select()
      .from(welfareHouseholds)
      .where(eq(welfareHouseholds.id, id))
      .limit(1);

    if (!updated) return notFound();

    return NextResponse.json({ household: updated });
  } catch (error) {
    return serverError(error, "Өрхийн мэдээлэл засахад алдаа гарлаа");
  }
}

/**
 * Өрхийг устгана.
 *
 * Халамжийн түүх нь `cascade`-ээр дагаж устдаг тул ХАЛАМЖ ҮЗҮҮЛСЭН өрхийг
 * устгах нь зарцуулсан мөнгөний бүртгэлийг хамт арилгана. Устгах эрх админ,
 * супер админд; UI-н баталгаажуулах цонх хэдэн бүртгэл устахыг тоогоор хэлнэ.
 */
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
      .select({ id: welfareHouseholds.id })
      .from(welfareHouseholds)
      .where(eq(welfareHouseholds.id, id))
      .limit(1);

    if (!existing) return notFound();

    await db.delete(welfareHouseholds).where(eq(welfareHouseholds.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Өрх устгахад алдаа гарлаа");
  }
}