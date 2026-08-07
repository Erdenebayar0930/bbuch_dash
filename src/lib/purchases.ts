"use client";

import { apiFetch } from "./apiClient";

import type { PurchaseStatus } from "@/data/supplyOptions";
import type { TaskPriority } from "@/data/taskOptions";

/** Худалдан авах жагсаалтын нэг мөр */
export type Purchase = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  /** Төсөвлөсөн нэгж үнэ, ₮ — 0 бол тодорхойгүй */
  estimatedPrice: number;
  priority: TaskPriority;
  status: PurchaseStatus;
  note: string;
  requestedBy: string | null;
  /** Хүсэгчийн харагдах нэр — бүртгэл устсан бол хоосон */
  requesterName: string;
  /** null бол хараахан аваагүй */
  boughtAt: Date | null;
  createdAt: Date;
};

type PurchaseRow = {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  estimatedPrice: number;
  priority: string;
  status: string;
  note: string | null;
  requestedBy: string | null;
  requesterFirstName: string | null;
  requesterLastName: string | null;
  boughtAt: string | null;
  createdAt: string;
};

const toPurchase = (row: PurchaseRow): Purchase => ({
  id: row.id,
  name: row.name,
  quantity: row.quantity ?? 0,
  unit: row.unit ?? "",
  estimatedPrice: row.estimatedPrice ?? 0,
  priority: row.priority as TaskPriority,
  status: row.status as PurchaseStatus,
  note: row.note ?? "",
  requestedBy: row.requestedBy,
  requesterName:
    [row.requesterFirstName, row.requesterLastName].filter(Boolean).join(" ") ||
    "",
  boughtAt: row.boughtAt ? new Date(row.boughtAt) : null,
  createdAt: new Date(row.createdAt),
});

/** Жагсаалт — шинэ хүсэлт эхэндээ. Төлөвөөр шүүх нь заавал биш. */
export async function listPurchases(status?: PurchaseStatus): Promise<Purchase[]> {
  const query = status ? `?status=${status}` : "";
  const data = await apiFetch<{ purchases: PurchaseRow[] }>(
    `/api/purchases${query}`
  );
  return (data.purchases ?? []).map(toPurchase);
}

export type PurchaseInput = {
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  priority: TaskPriority;
  note: string;
};

/** Шинэ хүсэлт нэмнэ. Төлөв нь үргэлж `requested`-ээр эхэлнэ. */
export async function createPurchase(input: PurchaseInput): Promise<Purchase> {
  const data = await apiFetch<{ purchase: PurchaseRow }>("/api/purchases", {
    method: "POST",
    body: input,
  });
  return toPurchase(data.purchase);
}

/**
 * Хүсэлтийг засна.
 * Төлөв солих нь админы эрх — хүсэгч зөвхөн шийдвэрлэгдээгүй мөрөө засна.
 */
export async function updatePurchase(
  id: string,
  patch: Partial<PurchaseInput & { status: PurchaseStatus }>
): Promise<Purchase> {
  const data = await apiFetch<{ purchase: PurchaseRow }>(
    `/api/purchases/${id}`,
    { method: "PATCH", body: patch }
  );
  return toPurchase(data.purchase);
}

/** Хүсэлтийг устгана. */
export async function deletePurchase(id: string): Promise<void> {
  await apiFetch(`/api/purchases/${id}`, { method: "DELETE" });
}