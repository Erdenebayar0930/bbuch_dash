import "server-only";

import { inArray } from "drizzle-orm";

import { assetStateLabels, isAssetState } from "@/data/assetStates";
import { aimags, labelOf } from "@/data/profileOptions";
import { db } from "@/lib/db";
import { assetCategories, assetHistory, warehouses, type AssetRow } from "@/lib/db/schema";

type Change = { field: string; from: string; to: string };

const stateLabel = (value: string) => (isAssetState(value) ? assetStateLabels[value] : value);

/** Төрөл, агуулахын id → нэр (түүхэнд нэрээр нь хадгална) */
async function namesOf(categoryIds: string[], warehouseIds: string[]) {
  const [cats, whs] = await Promise.all([
    categoryIds.length
      ? db.select({ id: assetCategories.id, name: assetCategories.name }).from(assetCategories).where(inArray(assetCategories.id, categoryIds))
      : [],
    warehouseIds.length
      ? db.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).where(inArray(warehouses.id, warehouseIds))
      : [],
  ]);
  return {
    category: new Map(cats.map((row) => [row.id, row.name])),
    warehouse: new Map(whs.map((row) => [row.id, row.name])),
  };
}

/** Шинээр бүртгэсэн эд хөрөнгө бүрт «Бүртгэсэн» түүх. */
export async function recordAssetsCreated(ids: string[], actorUid: string) {
  if (ids.length === 0) return;
  await db.insert(assetHistory).values(ids.map((assetId) => ({ assetId, action: "created", actorUid })));
}

/**
 * Засварын өмнөх ба дараах мөрийг харьцуулж, өөрчлөгдсөн талбар бүрийг
 * түүхэнд бичнэ. Юу ч өөрчлөгдөөгүй бол бичихгүй.
 */
export async function recordAssetChanges(before: AssetRow, after: AssetRow, actorUid: string) {
  const ids = (a: string | null, b: string | null) => [a, b].filter((value): value is string => !!value);
  const names = await namesOf(ids(before.categoryId, after.categoryId), ids(before.warehouseId, after.warehouseId));

  const fields: [string, string, string][] = [
    ["Нэр", before.name, after.name],
    ["Код", before.code, after.code],
    ["Ангилал", stateLabel(before.state), stateLabel(after.state)],
    [
      "Төрөл",
      before.categoryId ? names.category.get(before.categoryId) ?? "—" : "—",
      after.categoryId ? names.category.get(after.categoryId) ?? "—" : "—",
    ],
    [
      "Байршлын ангилал",
      before.warehouseId ? names.warehouse.get(before.warehouseId) ?? "—" : "—",
      after.warehouseId ? names.warehouse.get(after.warehouseId) ?? "—" : "—",
    ],
    [
      "Аймаг",
      before.aimag ? labelOf(aimags, before.aimag) : "—",
      after.aimag ? labelOf(aimags, after.aimag) : "—",
    ],
    ["Мэдээлэл", before.note, after.note],
  ];

  const changes: Change[] = fields
    .filter(([, from, to]) => (from ?? "") !== (to ?? ""))
    .map(([field, from, to]) => ({ field, from: from || "—", to: to || "—" }));

  if (changes.length === 0) return;
  await db.insert(assetHistory).values({ assetId: after.id, action: "updated", changes, actorUid });
}

/** Зураг нэмсэн / хассан түүх */
export async function recordAssetImage(assetId: string, added: boolean, actorUid: string) {
  await db.insert(assetHistory).values({ assetId, action: added ? "image_added" : "image_removed", actorUid });
}
