import "server-only";

import { and, eq } from "drizzle-orm";

import { campaignBoards, isCampaignBoard } from "@/data/campaignBoards";
import { isAdminRole, type Caller } from "@/lib/api/auth";
import { currentPeriod, rollOverMonthlyCampaigns } from "@/lib/api/campaignRollover";
import { notifyUsers, resolveNotifyTargets } from "@/lib/api/notify";
import { db } from "@/lib/db";
import { donationCampaigns, settings } from "@/lib/db/schema";

import type { DonationCampaignRow } from "@/lib/db/schema";

/**
 * Хандивын зөвшөөрөл.
 *
 * Админ зарлахад хандив `pending` болж зөвшөөрөгчид мэдэгдэл очно.
 * Зөвшөөрөгч «Зөвшөөрөх» (→ `approved`, бүх гишүүнд мэдэгдэл) эсвэл
 * «Өөрчлүүлэх» (→ `changes`, тайлбартай, зарласан админд мэдэгдэл) дарна.
 * Гишүүд зөвхөн `approved`-ийг харна.
 *
 * Зөвшөөрөгчдийг админ сонгоно (`settings.campaign_approvers`). Сонгоогүй бол
 * админ зөвшөөрнө.
 */

export const CAMPAIGN_STATUSES = ["pending", "approved", "changes"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

const APPROVERS_KEY = "campaign_approvers";

/** Хандив эсвэл Өглөгийн нэршил, хаяг */
const boardOf = (campaign: DonationCampaignRow) =>
  campaignBoards[isCampaignBoard(campaign.board) ? campaign.board : "donation"];

export async function readApprovers(): Promise<string[]> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, APPROVERS_KEY))
    .limit(1);
  try {
    const parsed: unknown = JSON.parse(row?.value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((uid): uid is string => typeof uid === "string") : [];
  } catch {
    return [];
  }
}

export async function writeApprovers(uids: string[]): Promise<void> {
  const value = JSON.stringify([...new Set(uids)]);
  await db
    .insert(settings)
    .values({ key: APPROVERS_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

/** Зөвшөөрөх эрх — сонгосон зөвшөөрөгч, эсвэл сонгоогүй үед админ */
export function canApprove(caller: Caller, approvers: string[]): boolean {
  return approvers.length > 0
    ? approvers.includes(caller.uid)
    : isAdminRole(caller.user?.role);
}

/** Тайлбарын эхний хэсэг — мэдэгдэлд */
const snippet = (text: string, max = 140) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

/** Зөвшөөрөгчдөд — шинэ эсвэл засагдсан хандив хүлээгдэж байна */
export async function notifyApprovers(campaign: DonationCampaignRow, edited: boolean) {
  const approvers = await readApprovers();
  const uids =
    approvers.length > 0
      ? approvers
      : [
          ...(await resolveNotifyTargets({ type: "role", role: "admin" })),
          ...(await resolveNotifyTargets({ type: "role", role: "super" })),
        ];

  const board = boardOf(campaign);
  await notifyUsers(
    uids,
    {
      title: `${edited ? "Засагдсан" : "Шинэ"} ${board.noun} зөвшөөрөл хүлээж байна`,
      body: campaign.title,
      url: board.url,
    },
    campaign.createdBy ?? undefined
  );
}

/** Зарласан админд — өөрчлүүлэхээр буцаасан */
export async function notifyChangesRequested(campaign: DonationCampaignRow, by: string) {
  if (!campaign.createdBy) return;
  const board = boardOf(campaign);
  await notifyUsers(
    [campaign.createdBy],
    {
      // «Хандивыг» / «Өглөгийг»
      title: `${board.accusative.charAt(0).toUpperCase()}${board.accusative.slice(1)} өөрчлүүлэх: ${campaign.title}`,
      body: campaign.reviewNote || "Зөвшөөрөгч өөрчлөлт хийхийг хүссэн.",
      url: board.url,
    },
    by
  );
}

/**
 * Хандивын хамааралтай гишүүд — `aimags` хоосон бол бүх идэвхтэй гишүүн,
 * эс бөгөөс сонгосон аймгуудын аль нэгэнд харьяалагдах идэвхтэй гишүүд.
 */
export function campaignAudience(aimags: readonly string[]): Promise<string[]> {
  return resolveNotifyTargets(
    aimags.length > 0 ? { type: "aimag", aimags: [...aimags] } : { type: "all" }
  );
}

/**
 * Хамааралтай гишүүдэд — шинэ хандив зарлагдлаа. `onlyUids` өгвөл зөвхөн
 * тэдэнд (зөвшөөрөгдсөн хандивын хүрээг тэлэхэд шинээр орсон хүмүүст).
 */
export async function announceCampaign(
  campaign: DonationCampaignRow,
  by: string,
  onlyUids?: string[]
) {
  const uids = onlyUids ?? (await campaignAudience(campaign.aimags));
  const board = boardOf(campaign);
  await notifyUsers(
    uids,
    {
      title: `Шинэ ${board.noun}: ${campaign.title}`,
      body: snippet(campaign.purpose) || `Санхүү → ${board.title} хэсгээс дэлгэрэнгүйг харна уу.`,
      url: board.url,
    },
    by
  );
}

/** Улаанбаатарын одоогийн өдөр (1-31) ба цаг (HH:mm) */
function ulaanbaatarClock() {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return { day: now.getUTCDate(), time: now.toISOString().slice(11, 16) };
}

/**
 * Сар бүрийн хандивын сануулга — cron (`/api/cron/notifications`) дууддаг.
 *
 * Зөвшөөрсөн, нээлттэй сар бүрийн хандив бүрд тухайн сарын `notifyDay`
 * өдрийн `notifyTime` болсон (эсвэл өнгөрсөн — cron алгассан ч гүйцээнэ)
 * бөгөөд энэ сард хараахан явуулаагүй бол хамааралтай гишүүдэд нэг удаа илгээнэ.
 */
export async function sendCampaignReminders(): Promise<{ id: string; title: string }[]> {
  await rollOverMonthlyCampaigns();

  const period = currentPeriod();
  const clock = ulaanbaatarClock();

  const rows = await db
    .select()
    .from(donationCampaigns)
    .where(
      and(
        eq(donationCampaigns.kind, "monthly"),
        eq(donationCampaigns.active, true),
        eq(donationCampaigns.status, "approved"),
        eq(donationCampaigns.period, period)
      )
    );

  const due = rows.filter(
    (row) =>
      row.lastNotifiedPeriod !== period &&
      (clock.day > row.notifyDay || (clock.day === row.notifyDay && clock.time >= row.notifyTime))
  );
  if (due.length === 0) return [];

  const [, month] = period.split("-").map(Number);
  const sent: { id: string; title: string }[] = [];

  for (const row of due) {
    // Эхлээд тэмдэглэнэ — зэрэг дуудлага давхар илгээхгүй
    const claimed = await db
      .update(donationCampaigns)
      .set({ lastNotifiedPeriod: period })
      .where(
        and(eq(donationCampaigns.id, row.id), eq(donationCampaigns.lastNotifiedPeriod, row.lastNotifiedPeriod))
      )
      .returning({ id: donationCampaigns.id });
    if (claimed.length === 0) continue;

    // Хандив бүр өөрийн хүрээтэй — сонгосон аймгуудад эсвэл бүгдэд
    await notifyUsers(
      await campaignAudience(row.aimags),
      {
        title: `Сар бүрийн хандив: ${row.title}`,
        body: `${month}-р сарын хандивын сануулга.${row.purpose ? ` ${snippet(row.purpose, 100)}` : ""}`,
        url: boardOf(row).url,
      },
      row.createdBy ?? undefined
    );
    sent.push({ id: row.id, title: row.title });
  }

  return sent;
}
