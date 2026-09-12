"use client";

import { apiFetch } from "./apiClient";

import type { VisitStatus } from "@/data/donationBoxOptions";

/** Жагсаалтад харуулах хамгийн сүүлийн эргэлтийн товч */
export type LastVisit = {
  status: VisitStatus;
  /** Хураасан дүн, ₮ */
  amount: number;
  /** Хураасан хувцас, ширхэг */
  clothingCount: number;
  visitedAt: Date;
};

/** Хандивын хайрцгийн байршил — газрын зураг дээрх тэмдэглэгээ */
export type DonationBox = {
  id: string;
  name: string;
  /** Хаяг, чиглүүлэг */
  address: string;
  lat: number;
  lng: number;
  note: string;
  /** false бол түр хураагдсан — зураг дээр бүдэг харагдана */
  active: boolean;
  /** null бол хараахан эргээгүй */
  lastVisit: LastVisit | null;
  /** Бүх эргэлтээр хураасан нийт дүн, ₮ */
  totalCollected: number;
  /** Бүх эргэлтээр хураасан нийт хувцас, ширхэг */
  totalClothing: number;
  createdAt: Date;
};

type BoxRow = Omit<DonationBox, "createdAt" | "lastVisit"> & {
  createdAt: string;
  lastVisit?: {
    status: VisitStatus;
    amount: number;
    clothingCount: number;
    visitedAt: string;
  } | null;
};

const toBox = (row: BoxRow): DonationBox => ({
  ...row,
  address: row.address ?? "",
  note: row.note ?? "",
  totalCollected: row.totalCollected ?? 0,
  totalClothing: row.totalClothing ?? 0,
  lastVisit: row.lastVisit
    ? { ...row.lastVisit, visitedAt: new Date(row.lastVisit.visitedAt) }
    : null,
  createdAt: new Date(row.createdAt),
});

/** Бүх байршил — идэвхгүй болсныг нь ч оруулна. */
export async function listDonationBoxes(): Promise<DonationBox[]> {
  const data = await apiFetch<{ boxes: BoxRow[] }>("/api/donation-boxes");
  return (data.boxes ?? []).map(toBox);
}

export type DonationBoxInput = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  note: string;
  active: boolean;
};

/** Шинэ байршил тэмдэглэнэ (зөвхөн админ). */
export async function createDonationBox(
  input: DonationBoxInput
): Promise<DonationBox> {
  const data = await apiFetch<{ box: BoxRow }>("/api/donation-boxes", {
    method: "POST",
    body: input,
  });
  return toBox(data.box);
}

/** Байршлыг засна (зөвхөн админ). */
export async function updateDonationBox(
  id: string,
  patch: Partial<DonationBoxInput>
): Promise<DonationBox> {
  const data = await apiFetch<{ box: BoxRow }>(`/api/donation-boxes/${id}`, {
    method: "PATCH",
    body: patch,
  });
  return toBox(data.box);
}

/** Байршлыг устгана (зөвхөн админ). Эргэлтийн түүх нь дагаж устана. */
export async function deleteDonationBox(id: string): Promise<void> {
  await apiFetch(`/api/donation-boxes/${id}`, { method: "DELETE" });
}

/** Нэг удаагийн эргэлтийн бүртгэл */
export type BoxVisit = {
  id: string;
  status: VisitStatus;
  /** Хураасан дүн, ₮ */
  amount: number;
  /** Хураасан хувцас, ширхэг */
  clothingCount: number;
  note: string;
  visitedAt: Date;
  /** Эргэсэн хүний нэр — устсан бүртгэл дээр хоосон байж болно */
  visitedByName: string;
};

type VisitRow = {
  id: string;
  status: VisitStatus;
  amount: number;
  clothingCount: number;
  note: string | null;
  visitedAt: string;
  visitedByName: string | null;
  visitedByLastName: string | null;
};

/** Тухайн хайрцгийн эргэлтийн түүх — сүүлийнх нь эхэндээ. */
export async function listBoxVisits(boxId: string): Promise<BoxVisit[]> {
  const data = await apiFetch<{ visits: VisitRow[] }>(
    `/api/donation-boxes/${boxId}/visits`
  );

  return (data.visits ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    amount: row.amount ?? 0,
    clothingCount: row.clothingCount ?? 0,
    note: row.note ?? "",
    visitedAt: new Date(row.visitedAt),
    visitedByName:
      [row.visitedByName, row.visitedByLastName].filter(Boolean).join(" ") ||
      "—",
  }));
}

/** Шинэ эргэлт бүртгэнэ (зөвхөн админ). */
export async function recordBoxVisit(
  boxId: string,
  input: {
    status: VisitStatus;
    amount: number;
    clothingCount: number;
    note: string;
  }
): Promise<void> {
  await apiFetch(`/api/donation-boxes/${boxId}/visits`, {
    method: "POST",
    body: input,
  });
}