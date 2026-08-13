import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { readAsset } from "@/lib/api/assetInput";
import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Эд хөрөнгийн бүртгэлийг засна (зөвхөн админ). */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const parsed = await readAsset(await request.json().catch(() => ({})), true);
    if (!parsed.ok) return badRequest(parsed.error);

    if (Object.keys(parsed.value).length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    // MySQL нь UPDATE ... RETURNING дэмждэггүй — засаад буцааж уншина.
    // Мөр байхгүй бол select ч хоосон буцаах тул 404 логик хэвээр ажиллана.
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
