"use client";

import { apiFetch } from "./apiClient";

/** tithe — 1/10 ба өргөл, land — Газрын 1/10 */
export type GivingBoard = "tithe" | "land";

export type GivingPerson = {
  id: string;
  /** Системийн хэрэглэгч бол uid, чөлөөт нэр бол null */
  uid: string | null;
  /** Харуулах нэр — хэрэглэгчийн одоогийн нэр, эсвэл хадгалсан нэр */
  name: string;
};

type PersonRow = {
  id: string;
  uid: string | null;
  name: string;
  firstName: string | null;
  lastName: string | null;
};

/** Жагсаалт ба тухайн жилийн өргөсөн сарууд (`personId` → {"YYYY-MM"}) */
export async function loadGiving(
  board: GivingBoard,
  year: number
): Promise<{ people: GivingPerson[]; marks: Map<string, Set<string>> }> {
  const data = await apiFetch<{
    people: PersonRow[];
    marks: { personId: string; month: string }[];
  }>(`/api/giving?board=${board}&year=${year}`);

  const people = data.people.map((row) => ({
    id: row.id,
    uid: row.uid,
    // Хэрэглэгчийн нэр солигдсон бол шинийг нь харуулна
    name:
      row.uid && (row.firstName || row.lastName)
        ? [row.lastName, row.firstName].filter(Boolean).join(" ")
        : row.name,
  }));

  const marks = new Map<string, Set<string>>();
  for (const mark of data.marks) {
    const set = marks.get(mark.personId) ?? new Set<string>();
    set.add(mark.month);
    marks.set(mark.personId, set);
  }

  return { people, marks };
}

export async function addGivingPerson(
  board: GivingBoard,
  person: { uid: string } | { name: string }
): Promise<void> {
  await apiFetch("/api/giving", { method: "POST", body: { board, ...person } });
}

export async function removeGivingPerson(id: string): Promise<void> {
  await apiFetch(`/api/giving/${id}`, { method: "DELETE" });
}

export async function setGivingMark(
  personId: string,
  month: string,
  given: boolean
): Promise<void> {
  await apiFetch(`/api/giving/${personId}`, {
    method: "PATCH",
    body: { month, given },
  });
}
