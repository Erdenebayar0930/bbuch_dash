import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { aimags, isValidOption } from "@/data/profileOptions";
import { allocateCodes, resolveCodeParts } from "@/lib/api/assetCodeAlloc";
import { readAsset } from "@/lib/api/assetInput";
import { recordAssetsCreated } from "@/lib/api/assetHistory";
import {
  badRequest,
  requireActiveUser,
  requireAimag,
  serverError,
  isAdminRole,
} from "@/lib/api/auth";
import { ASSET_AIMAG, requireAssetEditor } from "@/lib/api/assetAccess";
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

/** Нэг удаад олноор бүртгэх ширхэгийн дээд тоо */
const MAX_BULK = 500;

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
        state: assets.state,
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

    const { rows: latestCheckRows } = await db.execute(sql`
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

/** Шинэ эд хөрөнгө бүртгэнэ — админ эсвэл Магтаалын аймгийн гишүүн. */
export async function POST(request: NextRequest) {
  const result = await requireAssetEditor(request);
  if ("error" in result) return result.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = await readAsset(body, false);
    if (!parsed.ok) return badRequest(parsed.error);

    // Админ бус хүний бүртгэсэн хөрөнгө Магтаалын аймагт хамаарна
    if (!isAdminRole(result.caller.user?.role)) parsed.value.aimag = ASSET_AIMAG;

    // Кодыг гараар оруулахгүй — Байршлын ангилал + Төрөл + Нэрийн үсгээс
    // сервер өөрөө олгоно (ирсэн code/codes-ыг тооцохгүй). `count` нь хэдэн
    // ширхэг — ширхэг бүр тусдаа эд хөрөнгө, өөрийн кодтой.
    const parts = await resolveCodeParts(parsed.value.warehouseId, parsed.value.categoryId, parsed.value.name);
    if (!parts.ok) return badRequest(parts.error);

    const count = body.count === undefined ? 1 : Number(body.count);
    if (!Number.isInteger(count) || count < 1) return badRequest("Ширхэгийн тоо буруу байна.");
    if (count > MAX_BULK) {
      return badRequest(`Нэг удаад хамгийн ихдээ ${MAX_BULK} ширхэг бүртгэнэ.`);
    }

    const rows = await allocateCodes(parts.prefix, count, async (tx, codes) => {
      const values = codes.map((code) => ({
        ...parsed.value,
        id: crypto.randomUUID(),
        // Кодчиллын жагсаалтын бичлэгээр нь (том жижиг үсэг нэгэн жигд)
        name: parts.name,
        code,
        // Ширхэг бүр нэг эд хөрөнгө
        quantity: 1,
        createdBy: result.caller.uid,
      }));
      await tx.insert(assets).values(values);
      return values;
    });
    // Ширхэг бүрийн түүх «Бүртгэсэн»-ээр эхэлнэ
    await recordAssetsCreated(rows.map((row) => row.id), result.caller.uid);

    const [created] = await db.select().from(assets).where(eq(assets.id, rows[0].id));

    return NextResponse.json({
      asset: created,
      count: rows.length,
      ids: rows.map((row) => row.id),
      codes: rows.map((row) => row.code),
    });
  } catch (error) {
    return serverError(error, "Эд хөрөнгө бүртгэхэд алдаа гарлаа");
  }
}
