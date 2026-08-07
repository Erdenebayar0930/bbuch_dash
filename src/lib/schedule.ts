"use client";

import { apiFetch } from "./apiClient";

import type { ScheduleKind } from "@/data/scheduleOptions";

/** Хуваарийн нэг ээлж */
export type ScheduleShift = {
  id: string;
  kind: ScheduleKind;
  /** YYYY-MM-DD */
  date: string;
  /** null бол хараахан хуваарилаагүй */
  assignedTo: string | null;
  /** Хариуцагчийн харагдах нэр — хуваарилаагүй бол хоосон */
  assigneeName: string;
  assigneePhotoUrl: string;
  /** Талбай эсвэл гүйцэтгэх ажил */
  area: string;
  note: string;
  /** null бол гүйцэтгээгүй */
  doneAt: Date | null;
  createdAt: Date;
};

type ShiftRow = {
  id: string;
  kind: ScheduleKind;
  date: string;
  assignedTo: string | null;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
  assigneePhotoUrl: string | null;
  area: string | null;
  note: string | null;
  doneAt: string | null;
  createdAt: string;
};

const toShift = (row: ShiftRow): ScheduleShift => ({
  id: row.id,
  kind: row.kind,
  date: row.date,
  assignedTo: row.assignedTo,
  assigneeName:
    [row.assigneeFirstName, row.assigneeLastName].filter(Boolean).join(" ") ||
    "",
  assigneePhotoUrl: row.assigneePhotoUrl ?? "",
  area: row.area ?? "",
  note: row.note ?? "",
  doneAt: row.doneAt ? new Date(row.doneAt) : null,
  createdAt: new Date(row.createdAt),
});

/** Тухайн төрлийн ээлжүүд — огноогоор өсөхөөр. Хугацааны хязгаар заавал биш. */
export async function listShifts(
  kind: ScheduleKind,
  range: { from?: string; to?: string } = {}
): Promise<ScheduleShift[]> {
  const params = new URLSearchParams({ kind });
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);

  const data = await apiFetch<{ shifts: ShiftRow[] }>(
    `/api/schedule?${params.toString()}`
  );

  return (data.shifts ?? []).map(toShift);
}

export type ShiftInput = {
  /** YYYY-MM-DD */
  date: string;
  /** null бол хуваарилаагүй */
  assignedTo: string | null;
  area: string;
  note: string;
};

/** Шинэ ээлж нэмнэ (зөвхөн админ). */
export async function createShift(
  kind: ScheduleKind,
  input: ShiftInput
): Promise<ScheduleShift> {
  const data = await apiFetch<{ shift: ShiftRow }>("/api/schedule", {
    method: "POST",
    body: { ...input, kind },
  });
  return toShift(data.shift);
}

/** Ээлжийг засна (зөвхөн админ). */
export async function updateShift(
  id: string,
  patch: Partial<ShiftInput>
): Promise<ScheduleShift> {
  const data = await apiFetch<{ shift: ShiftRow }>(`/api/schedule/${id}`, {
    method: "PATCH",
    body: patch,
  });
  return toShift(data.shift);
}

/** Гүйцэтгэлийн тэмдэглэгээ — админ, эсвэл ээлжийн хариуцагч өөрөө. */
export async function setShiftDone(
  id: string,
  done: boolean
): Promise<ScheduleShift> {
  const data = await apiFetch<{ shift: ShiftRow }>(`/api/schedule/${id}`, {
    method: "PATCH",
    body: { done },
  });
  return toShift(data.shift);
}

/** Ээлжийг устгана (зөвхөн админ). */
export async function deleteShift(id: string): Promise<void> {
  await apiFetch(`/api/schedule/${id}`, { method: "DELETE" });
}