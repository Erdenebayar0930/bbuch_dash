import { asc, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { aimags, isValidOption } from "@/data/profileOptions";
import { readAsset } from "@/lib/api/assetInput";
import {
  badRequest,
  requireActiveUser,
  requireAdmin,
  requireAimag,
  serverError,
} from "@/lib/api/auth";
import { db } from "@/lib/db";
import {
  assetCategories,
  assetImages,
  assets,
  warehouses,
} from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Бүх эд хөрөнгө — агуулах, төрлийн нэртэй хамт.
 *
 * `?aimag=praise` өгвөл зөвхөн тухайн аймгийн хөрөнгө буцна; ийм хүсэлтийг
 * тухайн аймгийн гишүүн (эсвэл админ) л хийж чадна. Аймаггүй хүсэлт нь
 * чуулган нийтийн бүртгэл тул бүх идэвхтэй хэрэглэгчид нээлттэй.
 */
export async function GET(request: NextRequest) {
  // Хүсэлтээр ирсэн аймаг тогтсон жагсаалтад байх ёстой — таарахгүй бол
  // чимээгүй бүгдийг буцаахын оронд алдаа өгнө.
  const aimagParam = request.nextUrl.searchParams.get("aimag");

  const result =
    aimagParam && isValidOption(aimags, aimagParam)
      ? await requireAimag(request, aimagParam)
      : await requireActiveUser(request);

  if ("error" in result) return result.error;

  if (aimagParam !== null && !isValidOption(aimags, aimagParam)) {
    return badRequest("Аймаг буруу байна.");
  }

  try {
    const rows = await db
      .select({
        id: assets.id,
        name: assets.name,
        aimag: assets.aimag,
        categoryId: assets.categoryId,
        categoryName: assetCategories.name,
        warehouseId: assets.warehouseId,
        warehouseName: warehouses.name,
        quantity: assets.quantity,
        unit: assets.unit,
        code: assets.code,
        note: assets.note,
        createdAt: assets.createdAt,
      })
      .from(assets)
      .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
      .leftJoin(warehouses, eq(assets.warehouseId, warehouses.id))
      .where(aimagParam === null ? undefined : eq(assets.aimag, aimagParam))
      .orderBy(desc(assets.createdAt));

    // Зургийг тусад нь татаад бүлэглэнэ — join хийвэл хөрөнгийн мөр давхардана
    const imageRows = await db
      .select()
      .from(assetImages)
      .orderBy(asc(assetImages.position));

    const byAsset = new Map<string, typeof imageRows>();
    for (const image of imageRows) {
      const list = byAsset.get(image.assetId) ?? [];
      list.push(image);
      byAsset.set(image.assetId, list);
    }

    // Хөрөнгө тус бүрийн ХАМГИЙН СҮҮЛИЙН шалгалт. Postgres дээр энэ нь
    // `distinct on (asset_id)` байсан — MySQL-д тийм бүтэц байхгүй тул
    // цонхны функцээр мөр бүрийг дугаарлаад эхнийхийг нь авна. Хоёул бүх
    // түүхийг татаад санах ойд шүүхээс хямд.
    type LatestCheck = {
      asset_id: string;
      status: string;
      found_quantity: number;
      checked_at: Date;
    };

    const [latestCheckRows] = await db.execute(sql`
      select asset_id, status, found_quantity, checked_at
      from (
        select
          asset_id, status, found_quantity, checked_at,
          row_number() over (
            partition by asset_id order by checked_at desc
          ) as rn
        from asset_checks
      ) ranked
      where rn = 1
    `);

    const checkByAsset = new Map(
      (latestCheckRows as unknown as LatestCheck[]).map((row) => [
        row.asset_id,
        {
          status: row.status,
          foundQuantity: row.found_quantity,
          checkedAt: row.checked_at,
        },
      ])
    );

    return NextResponse.json({
      assets: rows.map((row) => ({
        ...row,
        images: byAsset.get(row.id) ?? [],
        lastCheck: checkByAsset.get(row.id) ?? null,
      })),
    });
  } catch (error) {
    return serverError(error, "Эд хөрөнгө уншихад алдаа гарлаа");
  }
}

/** Шинэ эд хөрөнгө бүртгэнэ (зөвхөн админ). */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const parsed = await readAsset(await request.json().catch(() => ({})), false);
    if (!parsed.ok) return badRequest(parsed.error);

    // MySQL нь INSERT ... RETURNING дэмждэггүй — ID-г урьдчилж үүсгэнэ
    const id = crypto.randomUUID();

    await db.insert(assets).values({
      ...parsed.value,
      id,
      name: parsed.value.name as string,
      createdBy: result.caller.uid,
    });

    const [created] = await db.select().from(assets).where(eq(assets.id, id));

    return NextResponse.json({ asset: created });
  } catch (error) {
    return serverError(error, "Эд хөрөнгө бүртгэхэд алдаа гарлаа");
  }
}
