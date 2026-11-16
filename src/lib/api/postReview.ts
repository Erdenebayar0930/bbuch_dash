import "server-only";

import { eq } from "drizzle-orm";

import { isAdminRole, type Caller } from "@/lib/api/auth";
import { notifyUsers, resolveNotifyTargets } from "@/lib/api/notify";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";

/**
 * Нүүр хуудасны нийтлэлийн зөвшөөрөл.
 *
 * Гишүүн нийтлэхэд `pending` болж зөвшөөрөгчдөд мэдэгдэл очно. Зөвшөөрөгч
 * «Зөвшөөрөх» (→ `approved`, бүгдэд харагдана) эсвэл «Буцаах» (→ `rejected`,
 * тайлбартай) дарна. Зөвшөөрөгч өөрөө нийтэлбэл шууд `approved`.
 * Бичсэн хүн засвал дахин `pending` болно.
 *
 * Зөвшөөрөгчдийг админ сонгоно (`settings.post_approvers`). Сонгоогүй бол
 * админ зөвшөөрнө — Хандивын зөвшөөрөлтэй ижил зарчим.
 */

export const POST_STATUSES = ["pending", "approved", "rejected"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

const APPROVERS_KEY = "post_approvers";

export async function readPostApprovers(): Promise<string[]> {
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

export async function writePostApprovers(uids: string[]): Promise<void> {
  const value = JSON.stringify([...new Set(uids)]);
  await db
    .insert(settings)
    .values({ key: APPROVERS_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

/** Зөвшөөрөх эрх — сонгосон зөвшөөрөгч, эсвэл сонгоогүй үед админ */
export function canApprovePosts(caller: Caller, approvers: string[]): boolean {
  return approvers.length > 0
    ? approvers.includes(caller.uid)
    : isAdminRole(caller.user?.role);
}

const snippet = (text: string, max = 120) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

/** Зөвшөөрөгчдөд — шинэ эсвэл засагдсан нийтлэл хүлээгдэж байна */
export async function notifyPostApprovers(post: { body: string }, authorUid: string, edited: boolean) {
  const approvers = await readPostApprovers();
  const uids =
    approvers.length > 0
      ? approvers
      : [
          ...(await resolveNotifyTargets({ type: "role", role: "admin" })),
          ...(await resolveNotifyTargets({ type: "role", role: "super" })),
        ];

  await notifyUsers(
    uids.filter((uid) => uid !== authorUid),
    {
      title: `${edited ? "Засагдсан" : "Шинэ"} нийтлэл зөвшөөрөл хүлээж байна`,
      body: snippet(post.body) || "Зураг/бичлэгтэй нийтлэл",
      url: "/",
    },
    authorUid
  );
}

/** Бичсэн хүнд — нийтлэл нь зөвшөөрөгдсөн эсвэл буцаагдсан */
export async function notifyPostAuthor(
  authorUid: string | null,
  status: "approved" | "rejected",
  note: string,
  by: string
) {
  if (!authorUid || authorUid === by) return;
  await notifyUsers(
    [authorUid],
    status === "approved"
      ? { title: "Таны нийтлэл зөвшөөрөгдлөө", body: "Нүүр хуудсанд бүгдэд харагдаж байна.", url: "/" }
      : { title: "Таны нийтлэлийг буцаалаа", body: note || "Зөвшөөрөгч засахыг хүссэн.", url: "/" },
    by
  );
}
