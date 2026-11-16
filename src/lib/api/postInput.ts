import "server-only";

import { eq } from "drizzle-orm";

import {
  POST_PERIOD,
  POST_PERIOD_MIN_YEAR,
  MAX_POST_LENGTH,
  MAX_POST_LINK_LENGTH,
  MAX_POST_MEDIA,
  parseVideoLink,
} from "@/data/postOptions";
import { db } from "@/lib/db";
import { posts, users } from "@/lib/db/schema";
import { isStoredFileUrl } from "@/lib/storageUrl";

export type PostMedia = { kind: "image" | "video"; url: string; path: string };

/** Сервер дээрх (`/uploads/...`) эсвэл Firebase-д үлдсэн хуучин файл */
const isStorageUrl = isStoredFileUrl;

/**
 * Огноотой нийтлэлийн `created_at` — тухайн өдрийн 12:00 (Улаанбаатар; зөвхөн
 * он сар бол 15-ны өдөр), гэхдээ одооноос хойш биш. Ингэж жагсаалтад
 * огноогоороо эрэмбэлэгдэнэ.
 */
export function periodDate(period: string, now = new Date()): Date {
  const [year, month, day = 15] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 4, 0, 0));
  return date.getTime() > now.getTime() ? now : date;
}

type Parsed =
  | { ok: true; value: { body: string; media: PostMedia[]; videoLink: string; period: string } }
  | { ok: false; error: string };

/**
 * Нийтлэлийн бичвэр, файл, холбоосыг шалгана.
 *
 * Шинэ файл нь ЗӨВХӨН илгээгчийн `posts/{uid}/` хавтаст байна — өөр хүний
 * файлыг холбож, дараа нь устгуулахаас сэргийлнэ. Засварт өмнө нь
 * хавсаргасан файлаа (`keepPaths`) хэвээр үлдээж болно.
 */
export function readPost(input: unknown, uid: string, keepPaths: readonly string[] = []): Parsed {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Хүсэлтийн бие буруу байна." };
  }

  const raw = input as Record<string, unknown>;
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const videoLink = typeof raw.videoLink === "string" ? raw.videoLink.trim() : "";
  const rawMedia: unknown[] = Array.isArray(raw.media) ? raw.media : [];
  const period = typeof raw.period === "string" ? raw.period.trim() : "";

  if (period) {
    const match = POST_PERIOD.exec(period);
    // Улаанбаатарын өнөөдөр (UTC+8) — хэрэглэгчийн хөтөчтэй таарна
    const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
    const [year, month, day] = period.split("-").map(Number);
    const real = !match?.[3] || new Date(Date.UTC(year, month - 1, day)).getUTCDate() === day;
    if (!match || !real || year < POST_PERIOD_MIN_YEAR || period > today) {
      return { ok: false, error: "Огноо буруу байна — ирээдүйн өдөр сонгож болохгүй." };
    }
  }

  if (body.length > MAX_POST_LENGTH) {
    return { ok: false, error: `Нийтлэл ${MAX_POST_LENGTH} тэмдэгтээс урт байж болохгүй.` };
  }
  if (videoLink.length > MAX_POST_LINK_LENGTH || (videoLink && !parseVideoLink(videoLink))) {
    return { ok: false, error: "Зөвхөн YouTube эсвэл Facebook видеоны холбоос оруулна." };
  }
  if (rawMedia.length > MAX_POST_MEDIA) {
    return { ok: false, error: `Хамгийн ихдээ ${MAX_POST_MEDIA} файл оруулна.` };
  }

  const ownPrefix = `posts/${uid}/`;
  const media: PostMedia[] = [];

  for (const item of rawMedia) {
    const { kind, url, path } = (item ?? {}) as Record<string, unknown>;
    if (
      (kind !== "image" && kind !== "video") ||
      typeof url !== "string" ||
      typeof path !== "string" ||
      !isStorageUrl(url) ||
      path.includes("..") ||
      !(path.startsWith(ownPrefix) || keepPaths.includes(path))
    ) {
      return { ok: false, error: "Файлын мэдээлэл буруу байна." };
    }
    media.push({ kind, url, path });
  }

  if (!body && media.length === 0 && !videoLink) {
    return { ok: false, error: "Бичвэр, зураг эсвэл бичлэг оруулна уу." };
  }

  return { ok: true, value: { body, media, videoLink, period } };
}

/** Жагсаалтын багана — бичсэн хүний нэр, зурагтай хамт */
export const postColumns = {
  id: posts.id,
  authorUid: posts.authorUid,
  authorFirstName: users.firstName,
  authorLastName: users.lastName,
  authorPhotoUrl: users.photoUrl,
  body: posts.body,
  media: posts.media,
  videoLink: posts.videoLink,
  period: posts.period,
  status: posts.status,
  reviewNote: posts.reviewNote,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
} as const;

/** Нэг нийтлэлийг жагсаалтын хэлбэрээр уншина. */
export async function readPostRow(id: string) {
  const [row] = await db
    .select(postColumns)
    .from(posts)
    .leftJoin(users, eq(posts.authorUid, users.uid))
    .where(eq(posts.id, id))
    .limit(1);

  return row ?? null;
}
