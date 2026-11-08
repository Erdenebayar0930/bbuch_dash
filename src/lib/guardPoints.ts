"use client";

import { apiFetch } from "./apiClient";

import type { GuardVisitStatus } from "@/data/guardOptions";

/** Харуулын цэг — газрын зураг дээрх тэмдэглэгээ */
export type GuardPoint = {
  id: string;
  name: string;
  /** Хаяг, чиглүүлэг */
  address: string;
  lat: number;
  lng: number;
  note: string;
  /** false бол түр идэвхгүй — зураг дээр бүдэг харагдана */
  active: boolean;
  /** null бол хараахан эргээгүй */
  lastVisit: { status: GuardVisitStatus; visitedAt: Date } | null;
  createdAt: Date;
};

type PointRow = Omit<GuardPoint, "createdAt" | "lastVisit"> & {
  createdAt: string;
  lastVisit?: { status: GuardVisitStatus; visitedAt: string } | null;
};

const toPoint = (row: PointRow): GuardPoint => ({
  ...row,
  address: row.address ?? "",
  note: row.note ?? "",
  lastVisit: row.lastVisit
    ? { ...row.lastVisit, visitedAt: new Date(row.lastVisit.visitedAt) }
    : null,
  createdAt: new Date(row.createdAt),
});

/** Бүх цэг — идэвхгүй болсныг нь ч оруулна. */
export async function listGuardPoints(): Promise<GuardPoint[]> {
  const data = await apiFetch<{ points: PointRow[] }>("/api/guard-points");
  return (data.points ?? []).map(toPoint);
}

export type GuardPointInput = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  note: string;
  active: boolean;
};

/** Шинэ цэг тэмдэглэнэ (зөвхөн админ). */
export async function createGuardPoint(
  input: GuardPointInput
): Promise<GuardPoint> {
  const data = await apiFetch<{ point: PointRow }>("/api/guard-points", {
    method: "POST",
    body: input,
  });
  return toPoint(data.point);
}

/** Цэгийг засна (зөвхөн админ). */
export async function updateGuardPoint(
  id: string,
  patch: Partial<GuardPointInput>
): Promise<GuardPoint> {
  const data = await apiFetch<{ point: PointRow }>(`/api/guard-points/${id}`, {
    method: "PATCH",
    body: patch,
  });
  return toPoint(data.point);
}

/** Цэгийг устгана (зөвхөн админ). Эргэлтийн түүх нь дагаж устана. */
export async function deleteGuardPoint(id: string): Promise<void> {
  await apiFetch(`/api/guard-points/${id}`, { method: "DELETE" });
}

/** Нэг удаагийн эргэлтийн бүртгэл */
export type GuardVisit = {
  id: string;
  status: GuardVisitStatus;
  note: string;
  visitedAt: Date;
  /** Эргэсэн хүний нэр — устсан бүртгэл дээр хоосон байж болно */
  visitedByName: string;
};

type VisitRow = {
  id: string;
  status: GuardVisitStatus;
  note: string | null;
  visitedAt: string;
  visitedByName: string | null;
  visitedByLastName: string | null;
};

/** Тухайн цэгийн эргэлтийн түүх — сүүлийнх нь эхэндээ. */
export async function listGuardVisits(pointId: string): Promise<GuardVisit[]> {
  const data = await apiFetch<{ visits: VisitRow[] }>(
    `/api/guard-points/${pointId}/visits`
  );

  return (data.visits ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    note: row.note ?? "",
    visitedAt: new Date(row.visitedAt),
    visitedByName:
      [row.visitedByName, row.visitedByLastName].filter(Boolean).join(" ") ||
      "—",
  }));
}

/** Шинэ эргэлт бүртгэнэ (зөвхөн админ). */
export async function recordGuardVisit(
  pointId: string,
  input: { status: GuardVisitStatus; note: string }
): Promise<void> {
  await apiFetch(`/api/guard-points/${pointId}/visits`, {
    method: "POST",
    body: input,
  });
}
