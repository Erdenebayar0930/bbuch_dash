"use client";

import { apiFetch } from "./apiClient";

export type SupplyKind = "money" | "item";

/** Чуулганд орж ирсэн мөнгө эсвэл эд зүйл */
export type Supply = {
  id: string;
  kind: SupplyKind;
  /** Юу — «Мөнгө», «Портер машин» г.м. */
  title: string;
  /** Зориулалт — «Портер авах» г.м. */
  purpose: string;
  /** Мөнгө бол дүн, эд зүйл бол үнэлгээ (₮); null бол үнэлээгүй */
  amount: number | null;
  quantity: number;
  giver: string;
  /** YYYY-MM-DD */
  receivedOn: string;
  note: string;
  createdAt: Date;
};

export type SupplyInput = Omit<Supply, "id" | "createdAt">;

type SupplyRow = Omit<Supply, "createdAt"> & { createdAt: string };

const toSupply = (row: SupplyRow): Supply => ({
  ...row,
  kind: row.kind === "item" ? "item" : "money",
  purpose: row.purpose ?? "",
  giver: row.giver ?? "",
  note: row.note ?? "",
  quantity: row.quantity ?? 1,
  createdAt: new Date(row.createdAt),
});

export async function listSupplies(): Promise<Supply[]> {
  const data = await apiFetch<{ supplies: SupplyRow[] }>("/api/supplies");
  return data.supplies.map(toSupply);
}

export async function createSupply(input: SupplyInput): Promise<Supply> {
  const data = await apiFetch<{ supply: SupplyRow }>("/api/supplies", {
    method: "POST",
    body: input,
  });
  return toSupply(data.supply);
}

export async function updateSupply(id: string, patch: Partial<SupplyInput>): Promise<Supply> {
  const data = await apiFetch<{ supply: SupplyRow }>(`/api/supplies/${id}`, {
    method: "PATCH",
    body: patch,
  });
  return toSupply(data.supply);
}

export async function deleteSupply(id: string): Promise<void> {
  await apiFetch(`/api/supplies/${id}`, { method: "DELETE" });
}
