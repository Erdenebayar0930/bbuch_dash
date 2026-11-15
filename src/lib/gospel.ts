"use client";

import type { GospelAimag, GospelResponse } from "@/data/gospelOptions";

import { apiFetch } from "./apiClient";

export type GospelContact = {
  id: string;
  name: string;
  phone: string;
  /** male | female | "" */
  gender: string;
  /** 0 бол тодорхойгүй */
  age: number;
  address: string;
  /** YYYY-MM-DD */
  sharedOn: string;
  response: GospelResponse;
  note: string;
  aimag: GospelAimag;
  sharedBy: string | null;
  sharedByName: string;
  createdAt: Date;
};

export type GospelContactInput = {
  name: string;
  phone: string;
  gender: string;
  age: number;
  address: string;
  sharedOn: string;
  response: GospelResponse;
  note: string;
  aimag: GospelAimag;
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
