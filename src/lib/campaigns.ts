"use client";

import { apiFetch } from "./apiClient";

import type { CampaignBoardKey } from "@/data/campaignBoards";

/** Хандивын төрөл */
export type CampaignKind = "monthly" | "once";

export const campaignKindLabels: Record<CampaignKind, string> = {
  monthly: "Сар бүр",
  once: "Нэг удаа",
};

/** Зөвшөөрлийн төлөв */
export type CampaignStatus = "pending" | "approved" | "changes";

export const campaignStatusLabels: Record<CampaignStatus, string> = {
  pending: "Зөвшөөрөл хүлээж буй",
  approved: "Зөвшөөрсөн",
  changes: "Өөрчлүүлэх",
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
  /** Хандив өгөх аймгууд — хоосон бол бүх гишүүн */
  aimags: string[];
  /** Хандивын зорилго */
  title: string;
  /** Тайлбар */
  purpose: string;
  /** Зорилтот дүн, ₮ — null бол тогтсон дүнгүй */
  targetAmount: number | null;
  /** Гүйлгээний утгын эхлэл — хоосон бол аяны нэр */
  memoPrefix: string;
  /** Өглөгийн данс — гараар оруулсан (Хандивт хоосон) */
  accountBank: string;
  accountNumber: string;
  accountHolder: string;
  /** YYYY-MM-DD, хоосон бол заагаагүй */
  endsOn: string;
  active: boolean;
  /** Зөвшөөрлийн төлөв — гишүүдэд зөвхөн approved ирнэ */
  status: CampaignStatus;
  /** Өөрчлүүлэх үеийн зөвшөөрөгчийн тайлбар */
  reviewNote: string;
  /** Сар бүрийнх: сарын хэдэнд сануулах (1-28) */
  notifyDay: number;
  /** Сар бүрийнх: сануулах цаг HH:mm */
  notifyTime: string;
  /** Зарласан хүний uid — тэр хүн засаж, хааж чадна */
  createdBy: string | null;
  createdAt: Date;
};

export type CampaignInput = Omit<
  Campaign,
  "id" | "createdAt" | "period" | "status" | "reviewNote" | "createdBy"
>;

type CampaignRow = Omit<Campaign, "createdAt" | "kind" | "status"> & {
  kind: string;
  status: string;
  createdAt: string;
};

const toCampaign = (row: CampaignRow): Campaign => ({
  ...row,
  kind: row.kind === "monthly" ? "monthly" : "once",
  period: row.period ?? "",
  position: row.position ?? 0,
  featured: row.featured ?? false,
  aimags: Array.isArray(row.aimags) ? row.aimags : [],
  purpose: row.purpose ?? "",
  memoPrefix: row.memoPrefix ?? "",
  accountBank: row.accountBank ?? "",
  accountNumber: row.accountNumber ?? "",
  accountHolder: row.accountHolder ?? "",
  endsOn: row.endsOn ?? "",
  status: row.status === "pending" || row.status === "changes" ? row.status : "approved",
  reviewNote: row.reviewNote ?? "",
  notifyDay: row.notifyDay ?? 1,
  notifyTime: row.notifyTime ?? "09:00",
  createdBy: row.createdBy ?? null,
  createdAt: new Date(row.createdAt),
});

/** Жагсаалт ба дуудагч зөвшөөрөх эрхтэй эсэх — `board`: Хандив эсвэл Өглөг */
export async function listCampaigns(
  board: CampaignBoardKey = "donation"
): Promise<{ campaigns: Campaign[]; canApprove: boolean }> {
  const data = await apiFetch<{ campaigns: CampaignRow[]; canApprove?: boolean }>(
    `/api/campaigns?board=${board}`
  );
  return { campaigns: data.campaigns.map(toCampaign), canApprove: data.canApprove ?? false };
}

/** Зөвшөөрөх эсвэл өөрчлүүлэхээр буцаана */
export async function reviewCampaign(
  id: string,
  review: { action: "approve" } | { action: "changes"; note: string }
): Promise<Campaign> {
  const data = await apiFetch<{ campaign: CampaignRow }>(`/api/campaigns/${id}/review`, {
    method: "POST",
    body: review,
  });
  return toCampaign(data.campaign);
}

/** Хандив зөвшөөрөх эрхтэй хүмүүс — зөвхөн админ */
export async function loadApprovers(): Promise<string[]> {
  const data = await apiFetch<{ uids: string[] }>("/api/campaigns/approvers");
  return data.uids;
}

export async function saveApprovers(uids: string[]): Promise<string[]> {
  const data = await apiFetch<{ uids: string[] }>("/api/campaigns/approvers", {
    method: "PUT",
    body: { uids },
  });
  return data.uids;
}

export async function createCampaign(
  input: CampaignInput,
  board: CampaignBoardKey = "donation"
): Promise<Campaign> {
  const data = await apiFetch<{ campaign: CampaignRow }>("/api/campaigns", {
    method: "POST",
    body: { ...input, board },
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
