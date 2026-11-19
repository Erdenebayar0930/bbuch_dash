import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireAdmin,
  isAdminRole,
  requireAimag,
  serverError,
} from "@/lib/api/auth";
import { removeStored } from "@/lib/api/fileStore";
import { welfareAimags } from "@/data/profileOptions";
import { readWelfareHousehold } from "@/lib/api/welfareInput";
import { boardOf, welfareTables } from "@/lib/api/dataBoard";
import { db } from "@/lib/db";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/** Өрхийн мэдээллийг засна (аймгийн гишүүн бүр). */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const board = boardOf(request);
  const { households: welfareHouseholds } = welfareTables(board);
  const result = await requireAimag(
    request,
    board === "tahilt" ? "tahilt" : welfareAimags
  );
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const [current] = await db
      .select({ photos: welfareHouseholds.photos })
      .from(welfareHouseholds)
      .where(eq(welfareHouseholds.id, id))
      .limit(1);
    if (!current) return notFound();

    const existing = current.photos ?? [];
    const parsed = readWelfareHousehold(
      await request.json().catch(() => ({})),
      true,
      {
        uploaderUid: result.caller.uid,
        existing,
        canRemove: isAdminRole(result.caller.user?.role),
      }
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

    // Админ хассан зургийн файлыг цэвэрлэнэ — алдаа нь хадгалалтыг саатуулахгүй
    if (parsed.value.photos) {
      const next = new Set(parsed.value.photos.map((photo) => photo.path));
      for (const photo of existing) {
        if (!next.has(photo.path)) await removeStored(photo.path).catch(() => {});
      }
    }

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
  const board = boardOf(request);
  const { households: welfareHouseholds } = welfareTables(board);
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