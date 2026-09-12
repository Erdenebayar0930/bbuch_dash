import "server-only";

import { eq } from "drizzle-orm";

import { aimags, isValidOption } from "@/data/profileOptions";
import { db } from "@/lib/db";
import { assetCategories, warehouses } from "@/lib/db/schema";

const MAX_NAME = 120;
const MAX_QUANTITY = 1_000_000;

export type AssetPatch = {
  name?: string;
  aimag?: string;
  categoryId?: string | null;
  warehouseId?: string | null;
  quantity?: number;
  unit?: string;
  code?: string;
  note?: string;
};

export type ParsedAsset =
  | { ok: true; value: AssetPatch }
  | { ok: false; error: string };

/**
 * Эд хөрөнгийн маягтын өгөгдлийг шалгана.
 *
 * `partial: true` үед зөвхөн ирсэн талбарыг шалгана — үүсгэх (бүх талбар
 * шаардлагатай) ба засах (хэсэгчилсэн) хоёрт хоёуланд нь ашиглагдана.
 */
export async function readAsset(
  body: unknown,
  partial: boolean
): Promise<ParsedAsset> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Өгөгдөл буруу байна." };
  }

  const input = body as Record<string, unknown>;
  const patch: AssetPatch = {};

  if (input.name !== undefined || !partial) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) return { ok: false, error: "Эд хөрөнгийн нэрийг оруулна уу." };
    if (name.length > MAX_NAME) {
      return {
        ok: false,
        error: `Нэр ${MAX_NAME} тэмдэгтээс урт байж болохгүй.`,
      };
    }
    patch.name = name;
  }

  if (input.aimag !== undefined) {
    const aimag = typeof input.aimag === "string" ? input.aimag.trim() : "";
    // Аймаг нь тогтсон жагсаалттай; хоосон нь "аймагт үл хамаарах" гэсэн үг
    if (!isValidOption(aimags, aimag)) {
      return { ok: false, error: "Аймаг буруу байна." };
    }
    patch.aimag = aimag;
  }

  for (const key of ["unit", "code", "note"] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== "string") {
      return { ok: false, error: `${key} нь текст байх ёстой.` };
    }
    patch[key] = (input[key] as string).trim();
  }

  if (input.quantity !== undefined) {
    const quantity = input.quantity;
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > MAX_QUANTITY
    ) {
      return { ok: false, error: "Тоо хэмжээ 0-ээс их бүхэл тоо байна." };
    }
    patch.quantity = quantity;
  }

  // Агуулах / төрөл байгаа эсэхийг шалгана — байхгүй бол FK алдаа өгнө
  for (const [key, table] of [
    ["categoryId", assetCategories],
    ["warehouseId", warehouses],
  ] as const) {
    if (input[key] === undefined) continue;

    const value = input[key];
    if (value === null || value === "") {
      patch[key] = null;
      continue;
    }
    if (typeof value !== "string") {
      return { ok: false, error: `${key} буруу байна.` };
    }

    const [found] = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.id, value))
      .limit(1);

    if (!found) {
      return {
        ok: false,
        error: key === "categoryId" ? "Төрөл олдсонгүй." : "Агуулах олдсонгүй.",
      };
    }
    patch[key] = value;
  }

  return { ok: true, value: patch };
}
