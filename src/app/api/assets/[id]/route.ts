import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { readAsset } from "@/lib/api/assetInput";
import { recordAssetChanges } from "@/lib/api/assetHistory";
import { badRequest, isAdminRole, requireAdmin, serverError } from "@/lib/api/auth";
import { ASSET_AIMAG, requireAssetEditor } from "@/lib/api/assetAccess";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Эд хөрөнгийн бүртгэлийг засна — админ эсвэл Магтаалын аймгийн гишүүн. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  // Админ эсвэл Магтаалын аймгийн гишүүн (тухайн хөрөнгө Магтаалынх байх)
  const result = await requireAssetEditor(request, id);
  if ("error" in result) return result.error;

  try {
    const parsed = await readAsset(await request.json().catch(() => ({})), true);
    if (!parsed.ok) return badRequest(parsed.error);

    // Админ бус хүн хөрөнгийг өөр аймаг руу шилжүүлэхгүй
    if (
      parsed.value.aimag !== undefined &&
      parsed.value.aimag !== ASSET_AIMAG &&
      !isAdminRole(result.caller.user?.role)
    ) {
      return badRequest("Эд хөрөнгө Магтаалын аймагт бүртгэлтэй байна.");
    }

    if (Object.keys(parsed.value).length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    // Түүхэнд харьцуулахын тулд засварын өмнөх мөр
    const [before] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
    if (!before) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    // Код гараар өөрчлөгдөхгүй — бүртгэхэд сервер олгосон хэвээр
    delete parsed.value.code;

    // Кодтой хөрөнгийн кодын багц (Байршлын ангилал, Төрөл, Нэр) түгжээтэй —
    // эс бөгөөс код нь бүрэлдэхүүнтэйгээ зөрнө
    if (before.code) {
      const locked =
        (parsed.value.warehouseId !== undefined && parsed.value.warehouseId !== before.warehouseId) ||
        (parsed.value.categoryId !== undefined && parsed.value.categoryId !== before.categoryId) ||
        (parsed.value.name !== undefined && parsed.value.name !== before.name);
      if (locked) {
        return badRequest(
          `«${before.code}» кодтой тул Байршлын ангилал, Төрөл, Нэрийг өөрчлөх боломжгүй.`
        );
      }
    }

    if (Object.keys(parsed.value).length === 0) {
      return NextResponse.json({ asset: before });
    }

    await db
      .update(assets)
      .set({ ...parsed.value, updatedAt: new Date() })
      .where(eq(assets.id, id));

    const [updated] = await db
      .select()
      .from(assets)
      .where(eq(assets.id, id))
      .limit(1);

    if (!updated) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    // Өөрчлөгдсөн талбар бүр ширхэгийн түүхэнд үлдэнэ
    await recordAssetChanges(before, updated, result.caller.uid);

    return NextResponse.json({ asset: updated });
  } catch (error) {
    return serverError(error, "Эд хөрөнгө засахад алдаа гарлаа");
  }
}

/** Эд хөрөнгийг бүртгэлээс хасна (зөвхөн админ). */
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
      .select({ id: assets.id })
      .from(assets)
      .where(eq(assets.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    await db.delete(assets).where(eq(assets.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Эд хөрөнгө устгахад алдаа гарлаа");
  }
}
