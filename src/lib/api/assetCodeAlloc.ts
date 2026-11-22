import "server-only";

import { eq, like, sql } from "drizzle-orm";

import { codeNumbers, codePrefix, formatCode } from "@/lib/assetCodes";
import { db } from "@/lib/db";
import { assetCategories, assetNames, assets, warehouses } from "@/lib/db/schema";

/** Нэрийг харьцуулах — том жижиг үсэг, илүү зайг үл тооно */
const sameName = (column: typeof assetNames.name, name: string) =>
  sql`lower(regexp_replace(trim(${column}), '[[:space:]]+', ' ', 'g')) = lower(regexp_replace(trim(${name}), '[[:space:]]+', ' ', 'g'))`;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CodeParts =
  | { ok: true; prefix: string; name: string }
  | { ok: false; error: string };

/**
 * Кодчилол — Байршлын ангилал, Төрөл, Нэр гурвыг заавал сонгосон байх ба
 * гурвуулаа үсэгтэй байна. Угтвар (ТГАТ-) ба Кодчиллын жагсаалт дахь нэрийг
 * буцаана.
 */
export async function resolveCodeParts(
  warehouseId: string | null | undefined,
  categoryId: string | null | undefined,
  name: string | undefined
): Promise<CodeParts> {
  if (!warehouseId) return { ok: false, error: "Байршлын ангиллаа сонгоно уу." };
  if (!categoryId) return { ok: false, error: "Төрлөө сонгоно уу." };
  if (!name?.trim()) return { ok: false, error: "Нэрээ сонгоно уу." };

  const [[warehouse], [category], [named]] = await Promise.all([
    db.select({ letter: warehouses.codeLetter, name: warehouses.name }).from(warehouses).where(eq(warehouses.id, warehouseId)).limit(1),
    db.select({ letter: assetCategories.codeLetter, name: assetCategories.name }).from(assetCategories).where(eq(assetCategories.id, categoryId)).limit(1),
    db.select({ letter: assetNames.codeLetter, name: assetNames.name }).from(assetNames).where(sameName(assetNames.name, name)).limit(1),
  ]);

  if (!warehouse) return { ok: false, error: "Байршлын ангилал олдсонгүй." };
  if (!category) return { ok: false, error: "Төрөл олдсонгүй." };
  if (!named) return { ok: false, error: "Нэр Кодчилолд бүртгэгдээгүй байна — жагсаалтаас сонгоно уу." };
  if (!warehouse.letter) return { ok: false, error: `«${warehouse.name}» байршилд эхний үсэг оноогоогүй байна (Кодчилол).` };
  if (!category.letter) return { ok: false, error: `«${category.name}» төрөлд 2 дахь үсэг оноогоогүй байна (Кодчилол).` };
  if (!named.letter) return { ok: false, error: `«${named.name}» нэрд үсэг оноогоогүй байна (Кодчилол).` };

  return { ok: true, prefix: codePrefix(warehouse.letter, category.letter, named.letter), name: named.name };
}

/**
 * Дараагийн `count` чөлөөтэй кодыг олгоно — БҮХ эд хөрөнгийг (бусад аймаг,
 * акталсан ч) харж, хамгийн их дугаараас үргэлжлүүлнэ. Гүйлгээн дотор
 * угтвар бүрээр түгжинэ — зэрэг бүртгэхэд ижил код гарахгүй. Мөр оруулах
 * ажлыг мөн тэр гүйлгээнд хийнэ (`insert`).
 */
export async function allocateCodes<T>(
  prefix: string,
  count: number,
  insert: (tx: Tx, codes: string[]) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"asset-code:" + prefix}))`);

    const escaped = prefix.replace(/[\\%_]/g, (char) => `\\${char}`);
    const rows = await tx.select({ code: assets.code }).from(assets).where(like(assets.code, `${escaped}%`));
    const { numbers, width } = codeNumbers(prefix, rows.map((row) => row.code));
    const start = (numbers.length ? Math.max(...numbers) : 0) + 1;
    const codes = Array.from({ length: count }, (_, index) => formatCode(prefix, start + index, width));

    return insert(tx, codes);
  });
}
