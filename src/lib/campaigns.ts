"use client";

import { apiFetch } from "./apiClient";

/** Хандивын төрөл */
export type CampaignKind = "monthly" | "once";

export const campaignKindLabels: Record<CampaignKind, string> = {
  monthly: "Сар бүр",
  once: "Нэг удаа",
};

/** Хандивын аян (Санхүү → Хандив) */
export type Campaign = {
  id: string;
  kind: CampaignKind;
  /** Сар бүрийнх: YYYY-MM, нэг удаагийнх: хоосон */
  period: string;
  /** Админы эрэмбэ — бага нь дээрээ */
  position: number;
  /** Онцлох — хамгийн дээр */
  featured: boolean;
  /** Хандивын зорилго */
  title: string;
  /** Тайлбар */
  purpose: string;
  /** Зорилтот дүн, ₮ — null бол тогтсон дүнгүй */
  targetAmount: number | null;
  /** Гүйлгээний утгын эхлэл — хоосон бол аяны нэр */
  memoPrefix: string;
  /** YYYY-MM-DD, хоосон бол заагаагүй */
  endsOn: string;
  active: boolean;
  createdAt: Date;
};

export type CampaignInput = Omit<Campaign, "id" | "createdAt" | "period">;

type CampaignRow = Omit<Campaign, "createdAt" | "kind"> & {
  kind: string;
  createdAt: string;
};

const toCampaign = (row: CampaignRow): Campaign => ({
  ...row,
  kind: row.kind === "monthly" ? "monthly" : "once",
  period: row.period ?? "",
  position: row.position ?? 0,
  featured: row.featured ?? false,
  purpose: row.purpose ?? "",
  memoPrefix: row.memoPrefix ?? "",
  endsOn: row.endsOn ?? "",
  createdAt: new Date(row.createdAt),
});

export async function listCampaigns(): Promise<Campaign[]> {
  const data = await apiFetch<{ campaigns: CampaignRow[] }>("/api/campaigns");
  return data.campaigns.map(toCampaign);
}

export async function createCampaign(input: CampaignInput): Promise<Campaign> {
  const data = await apiFetch<{ campaign: CampaignRow }>("/api/campaigns", {
    method: "POST",
    body: input,
  });
  return toCampaign(data.campaign);
}

export async function updateCampaign(
  id: string,
  patch: Partial<CampaignInput>
): Promise<Campaign> {
  const data = await apiFetch<{ campaign: CampaignRow }>(`/api/campaigns/${id}`, {
    method: "PATCH",
    body: patch,
  });
  return toCampaign(data.campaign);
}

export async function deleteCampaign(id: string): Promise<void> {
  await apiFetch(`/api/campaigns/${id}`, { method: "DELETE" });
}
