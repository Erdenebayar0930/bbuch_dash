"use client";

import type { GospelAimag } from "@/data/gospelOptions";

import { apiFetch } from "./apiClient";

export type GospelContact = {
  id: string;
  /** Овог нэр — нэг талбарт */
  name: string;
  phone: string;
  /** male | female | "" */
  gender: string;
  /** Төрсөн он — 0 бол тодорхойгүй */
  birthYear: number;
  address: string;
  /** YYYY-MM-DD, хоосон бол хүлээж аваагүй */
  holySpiritBaptismDate: string;
  waterBaptismDate: string;
  /** Бүртгэсэн өдөр, YYYY-MM-DD */
  sharedOn: string;
  note: string;
  /** Хоосон бол зураггүй */
  photoUrl: string;
  photoPath: string;
  aimag: GospelAimag;
  /** Задаргаа (эсвэл задаргаагүй таб) — @see GospelArea */
  areaId: string;
  sharedBy: string | null;
  sharedByName: string;
  createdAt: Date;
};

export type GospelContactInput = {
  name: string;
  phone: string;
  gender: string;
  birthYear: number;
  address: string;
  holySpiritBaptismDate: string;
  waterBaptismDate: string;
  note: string;
  photoUrl: string;
  photoPath: string;
  aimag: GospelAimag;
  areaId: string;
};

type GospelRow = Omit<GospelContact, "sharedByName" | "createdAt"> & {
  sharedByFirstName: string | null;
  sharedByLastName: string | null;
  createdAt: string;
};

const toContact = (row: GospelRow): GospelContact => {
  const { sharedByFirstName, sharedByLastName, ...rest } = row;

  return {
    ...rest,
    note: rest.note ?? "",
    sharedByName:
      [sharedByFirstName, sharedByLastName].filter(Boolean).join(" ") ||
      "Тодорхойгүй",
    createdAt: new Date(row.createdAt),
  };
};

export async function listGospelContacts(): Promise<GospelContact[]> {
  const data = await apiFetch<{ contacts: GospelRow[] }>("/api/gospel");
  return data.contacts.map(toContact);
}

export async function createGospelContact(
  input: GospelContactInput
): Promise<GospelContact> {
  const data = await apiFetch<{ contact: GospelRow }>("/api/gospel", {
    method: "POST",
    body: input,
  });
  return toContact(data.contact);
}

export async function updateGospelContact(
  id: string,
  input: Partial<GospelContactInput>
): Promise<GospelContact> {
  const data = await apiFetch<{ contact: GospelRow }>(`/api/gospel/${id}`, {
    method: "PATCH",
    body: input,
  });
  return toContact(data.contact);
}

export async function deleteGospelContact(id: string): Promise<void> {
  await apiFetch(`/api/gospel/${id}`, { method: "DELETE" });
}

/** Таб (`parentId` = null) эсвэл түүний задаргаа */
export type GospelArea = {
  id: string;
  parentId: string | null;
  name: string;
  position: number;
};

export async function listGospelAreas(): Promise<GospelArea[]> {
  const data = await apiFetch<{ areas: GospelArea[] }>("/api/gospel/areas");
  return data.areas;
}

export async function createGospelArea(
  name: string,
  parentId: string | null
): Promise<GospelArea> {
  const data = await apiFetch<{ area: GospelArea }>("/api/gospel/areas", {
    method: "POST",
    body: { name, parentId },
  });
  return data.area;
}

export async function renameGospelArea(id: string, name: string): Promise<GospelArea> {
  const data = await apiFetch<{ area: GospelArea }>(`/api/gospel/areas/${id}`, {
    method: "PATCH",
    body: { name },
  });
  return data.area;
}

export async function deleteGospelArea(id: string): Promise<void> {
  await apiFetch(`/api/gospel/areas/${id}`, { method: "DELETE" });
}
