"use client";

import { apiFetch } from "./apiClient";

import type { DonationAccount } from "@/data/donationAccounts";

export type { DonationAccount };

/** Дансны жагсаалт — бүх идэвхтэй хэрэглэгч уншина. */
export async function listDonationAccounts(): Promise<DonationAccount[]> {
  const data = await apiFetch<{ accounts: DonationAccount[] }>(
    "/api/donation-accounts"
  );
  return data.accounts;
}

export type DonationAccountInput = {
  title: string;
  number: string;
  bank: string;
  holder: string;
  isTithe?: boolean;
  allowedUids?: string[];
  allowedAimags?: string[];
};

export async function createDonationAccount(input: DonationAccountInput) {
  return apiFetch<{ account: DonationAccount }>("/api/donation-accounts", {
    method: "POST",
    body: input,
  });
}

export async function updateDonationAccount(
  id: string,
  patch: Partial<DonationAccountInput>
) {
  return apiFetch<{ account: DonationAccount }>(
    `/api/donation-accounts?id=${encodeURIComponent(id)}`,
    { method: "PATCH", body: patch }
  );
}

export async function deleteDonationAccount(id: string) {
  return apiFetch(`/api/donation-accounts?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
