"use client";

import { apiFetch } from "./apiClient";

/** Жагсаалтад харуулах хамгийн сүүлийн тусламжийн товч */
export type LastAid = {
  description: string;
  /** Зарцуулсан дүн, ₮ */
  amount: number;
  providedAt: Date;
};

/** Халамжийн үйлчлэлд хамрагдах өрх */
export type WelfareHousehold = {
  id: string;
  name: string;
  phone: string;
  /** Гэр бүлийн гишүүдийн тоо */
  familySize: number;
  note: string;
  lat: number;
  lng: number;
  /** false бол жагсаалтаас түр гарсан — зураг дээр бүдэг харагдана */
  active: boolean;
  /** null бол хараахан халамж үзүүлээгүй */
  lastAid: LastAid | null;
  /** Бүх тусламжид зарцуулсан нийт дүн, ₮ */
  totalAmount: number;
  /** Хэдэн удаа халамж үзүүлсэн */
  aidCount: number;
  createdAt: Date;
};

type HouseholdRow = Omit<WelfareHousehold, "createdAt" | "lastAid"> & {
  createdAt: string;
  lastAid?: {
    description: string;
    amount: number;
    providedAt: string;
  } | null;
};

const toHousehold = (row: HouseholdRow): WelfareHousehold => ({
  ...row,
  phone: row.phone ?? "",
  note: row.note ?? "",
  familySize: row.familySize ?? 0,
  totalAmount: row.totalAmount ?? 0,
  aidCount: row.aidCount ?? 0,
  lastAid: row.lastAid
    ? { ...row.lastAid, providedAt: new Date(row.lastAid.providedAt) }
    : null,
  createdAt: new Date(row.createdAt),
});

/** Бүх өрх — идэвхгүй болсныг нь ч оруулна. */
export async function listHouseholds(): Promise<WelfareHousehold[]> {
  const data = await apiFetch<{ households: HouseholdRow[] }>("/api/welfare");
  return (data.households ?? []).map(toHousehold);
}

export type HouseholdInput = {
  name: string;
  phone: string;
  familySize: number;
  note: string;
  lat: number;
  lng: number;
  active: boolean;
};

/** Шинэ өрх бүртгэнэ (зөвхөн админ). */
export async function createHousehold(
  input: HouseholdInput
): Promise<WelfareHousehold> {
  const data = await apiFetch<{ household: HouseholdRow }>("/api/welfare", {
    method: "POST",
    body: input,
  });
  return toHousehold(data.household);
}

/** Өрхийн мэдээллийг засна (зөвхөн админ). */
export async function updateHousehold(
  id: string,
  patch: Partial<HouseholdInput>
): Promise<WelfareHousehold> {
  const data = await apiFetch<{ household: HouseholdRow }>(
    `/api/welfare/${id}`,
    { method: "PATCH", body: patch }
  );
  return toHousehold(data.household);
}

/** Өрхийг устгана (зөвхөн админ). Халамжийн түүх нь дагаж устана. */
export async function deleteHousehold(id: string): Promise<void> {
  await apiFetch(`/api/welfare/${id}`, { method: "DELETE" });
}

/** Нэг удаагийн халамжийн бүртгэл */
export type WelfareAid = {
  id: string;
  /** Юу үзүүлсэн */
  description: string;
  /** Зарцуулсан дүн, ₮ */
  amount: number;
  note: string;
  providedAt: Date;
  /** Үзүүлсэн хүний нэр — устсан бүртгэл дээр хоосон байж болно */
  providedByName: string;
};

type AidRow = {
  id: string;
  description: string;
  amount: number;
  note: string | null;
  providedAt: string;
  providedByName: string | null;
  providedByLastName: string | null;
};

/** Тухайн өрхөд үзүүлсэн халамжийн түүх — сүүлийнх нь эхэндээ. */
export async function listAids(householdId: string): Promise<WelfareAid[]> {
  const data = await apiFetch<{ aids: AidRow[] }>(
    `/api/welfare/${householdId}/aids`
  );

  return (data.aids ?? []).map((row) => ({
    id: row.id,
    description: row.description,
    amount: row.amount ?? 0,
    note: row.note ?? "",
    providedAt: new Date(row.providedAt),
    providedByName:
      [row.providedByName, row.providedByLastName].filter(Boolean).join(" ") ||
      "—",
  }));
}

/** Шинэ халамжийн бүртгэл нэмнэ (зөвхөн админ). */
export async function recordAid(
  householdId: string,
  input: { description: string; amount: number; note: string }
): Promise<void> {
  await apiFetch(`/api/welfare/${householdId}/aids`, {
    method: "POST",
    body: input,
  });
}