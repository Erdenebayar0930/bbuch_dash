"use client";

import { apiFetch } from "./apiClient";

/**
 * Аль сан: `main` — бүх аймгийн нэгдсэн Халамж, `tahilt` — Тахилтын цэсийн
 * тусдаа Халамж (`tahilt` schema). Хоёулаа ижил API-аар, `?board=`-оор ялгарна.
 */
export type WelfareBoard = "main" | "tahilt";

const q = (board: WelfareBoard) => (board === "tahilt" ? "?board=tahilt" : "");

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
  /** Өрхийн зургууд, ихдээ 3 */
  photos: WelfarePhoto[];
  /** null бол хараахан халамж үзүүлээгүй */
  lastAid: LastAid | null;
  /** Бүх тусламжид зарцуулсан нийт дүн, ₮ */
  totalAmount: number;
  /** Хэдэн удаа халамж үзүүлсэн */
  aidCount: number;
  createdAt: Date;
};

type HouseholdRow = Omit<WelfareHousehold, "createdAt" | "lastAid" | "photos"> & {
  photos: WelfarePhoto[] | null;
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
  photos: Array.isArray(row.photos) ? row.photos : [],
  createdAt: new Date(row.createdAt),
});

/** Бүх өрх — идэвхгүй болсныг нь ч оруулна. */
export async function listHouseholds(
  board: WelfareBoard = "main"
): Promise<WelfareHousehold[]> {
  const data = await apiFetch<{ households: HouseholdRow[] }>(`/api/welfare${q(board)}`);
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
  photos: WelfarePhoto[];
};

/** Шинэ өрх бүртгэнэ (зөвхөн админ). */
export async function createHousehold(
  input: HouseholdInput,
  board: WelfareBoard = "main"
): Promise<WelfareHousehold> {
  const data = await apiFetch<{ household: HouseholdRow }>(`/api/welfare${q(board)}`, {
    method: "POST",
    body: input,
  });
  return toHousehold(data.household);
}

/** Өрхийн мэдээллийг засна (зөвхөн админ). */
export async function updateHousehold(
  id: string,
  patch: Partial<HouseholdInput>,
  board: WelfareBoard = "main"
): Promise<WelfareHousehold> {
  const data = await apiFetch<{ household: HouseholdRow }>(
    `/api/welfare/${id}${q(board)}`,
    { method: "PATCH", body: patch }
  );
  return toHousehold(data.household);
}

/** Өрхийг устгана (зөвхөн админ). Халамжийн түүх нь дагаж устана. */
export async function deleteHousehold(
  id: string,
  board: WelfareBoard = "main"
): Promise<void> {
  await apiFetch(`/api/welfare/${id}${q(board)}`, { method: "DELETE" });
}

export type WelfarePhoto = { url: string; path: string };

/** Нэг удаагийн халамжийн бүртгэл */
export type WelfareAid = {
  id: string;
  /** Юу үзүүлсэн */
  description: string;
  /** Зарцуулсан дүн, ₮ */
  amount: number;
  note: string;
  /** Халамж үзүүлэх үеийн зургууд — хадгалсны дараа өөрчлөгдөхгүй */
  photos: WelfarePhoto[];
  providedAt: Date;
  /** Үзүүлсэн хүний нэр — устсан бүртгэл дээр хоосон байж болно */
  providedByName: string;
};

type AidRow = {
  id: string;
  description: string;
  amount: number;
  note: string | null;
  photos: WelfarePhoto[] | null;
  providedAt: string;
  providedByName: string | null;
  providedByLastName: string | null;
};

/** Тухайн өрхөд үзүүлсэн халамжийн түүх — сүүлийнх нь эхэндээ. */
export async function listAids(
  householdId: string,
  board: WelfareBoard = "main"
): Promise<WelfareAid[]> {
  const data = await apiFetch<{ aids: AidRow[] }>(
    `/api/welfare/${householdId}/aids${q(board)}`
  );

  return (data.aids ?? []).map((row) => ({
    id: row.id,
    description: row.description,
    amount: row.amount ?? 0,
    note: row.note ?? "",
    photos: Array.isArray(row.photos) ? row.photos : [],
    providedAt: new Date(row.providedAt),
    providedByName:
      [row.providedByName, row.providedByLastName].filter(Boolean).join(" ") ||
      "—",
  }));
}

/** Шинэ халамжийн бүртгэл нэмнэ (аймгийн гишүүн бүр). */
export async function recordAid(
  householdId: string,
  input: {
    description: string;
    amount: number;
    note: string;
    photos?: WelfarePhoto[];
  },
  board: WelfareBoard = "main"
): Promise<void> {
  await apiFetch(`/api/welfare/${householdId}/aids${q(board)}`, {
    method: "POST",
    body: input,
  });
}