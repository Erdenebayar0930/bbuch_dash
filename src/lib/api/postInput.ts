import "server-only";

import { eq } from "drizzle-orm";

import {
  POST_PERIOD,
  POST_PERIOD_MIN_YEAR,
  MAX_POST_LENGTH,
  postDateKey,
  MAX_POST_FILE_BYTES,
  MAX_POST_FILE_NAME,
  MAX_POST_LINK_LENGTH,
  MAX_POST_MEDIA,
  MAX_POST_TAG_NAME,
  MAX_POST_TAGS,
  parseVideoLink,
  type PostTag,
} from "@/data/postOptions";
import { db } from "@/lib/db";
import { posts, users } from "@/lib/db/schema";
import { isStoredFileUrl } from "@/lib/storageUrl";

export type PostMedia = {
  kind: "image" | "video" | "file";
  url: string;
  path: string;
  name?: string;
  size?: number;
};

/** Сервер дээрх (`/uploads/...`) эсвэл Firebase-д үлдсэн хуучин файл */
const isStorageUrl = isStoredFileUrl;

/**
 * Нийтлэлийн `created_at` — хэрэглэгчийн сонгосон ӨДӨР (Улаанбаатар) + одоогийн
 * цаг. Жагсаалт энэ баганаар эрэмбэлэгддэг тул нийтлэл сонгосон өдрийнхөө
 * байранд орно; нэг өдөрт оруулсан хэд хэдэн нийтлэл оруулсан дарааллаа
 * хадгална. Өнөөдрийг сонгосон бол яг одоо. Зөвхөн он сар (`YYYY-MM`) бол 15-ны өдөр.
 */
export function periodDate(period: string, now = new Date()): Date {
  const [year, month, day = 15] = period.split("-").map(Number);
  const ub = 8 * 3_600_000;
  const timeOfDay = (now.getTime() + ub) % 86_400_000;
  const date = new Date(Date.UTC(year, month - 1, day) - ub + timeOfDay);
  return date.getTime() > now.getTime() ? now : date;
}

type Parsed =
  | { ok: true; value: { body: string; media: PostMedia[]; videoLink: string; period: string; tags: PostTag[] } }
  | { ok: false; error: string };

/**
 * Нийтлэлийн бичвэр, файл, холбоосыг шалгана.
 *
 * Шинэ файл нь ЗӨВХӨН илгээгчийн `posts/{uid}/` хавтаст байна — өөр хүний
 * файлыг холбож, дараа нь устгуулахаас сэргийлнэ. Засварт өмнө нь
 * хавсаргасан файлаа (`keepPaths`) хэвээр үлдээж болно.
 */
export function readPost(
  input: unknown,
  uid: string,
  keepPaths: readonly string[] = [],
  /** Нэр цохож болдог самбар эсэх (@see TAGGABLE_BOARDS) — үгүй бол нэрс хадгалагдахгүй */
  allowTags = false
): Parsed {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Хүсэлтийн бие буруу байна." };
  }

  const raw = input as Record<string, unknown>;
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const videoLink = typeof raw.videoLink === "string" ? raw.videoLink.trim() : "";
  const rawMedia: unknown[] = Array.isArray(raw.media) ? raw.media : [];
  // Огноо заавал байна — ирээгүй бол өнөөдөр (Улаанбаатар)
  const period = (typeof raw.period === "string" ? raw.period.trim() : "") || postDateKey(new Date());

  if (period) {
    const match = POST_PERIOD.exec(period);
    // Улаанбаатарын өнөөдөр (UTC+8) — хэрэглэгчийн хөтөчтэй таарна
    const today = postDateKey(new Date());
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
    const { kind, url, path, name, size } = (item ?? {}) as Record<string, unknown>;
    if (
      (kind !== "image" && kind !== "video" && kind !== "file") ||
      typeof url !== "string" ||
      typeof path !== "string" ||
      !isStorageUrl(url) ||
      path.includes("..") ||
      !(path.startsWith(ownPrefix) || keepPaths.includes(path))
    ) {
      return { ok: false, error: "Файлын мэдээлэл буруу байна." };
    }
    if (kind === "file") {
      // Нэр нь зөвхөн харуулах зорилготой — удирдах тэмдэгтүүдийг хасна
      const cleanName =
        typeof name === "string" ? name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_POST_FILE_NAME) : "";
      const cleanSize =
        typeof size === "number" && Number.isFinite(size) && size >= 0 && size <= MAX_POST_FILE_BYTES
          ? Math.round(size)
          : 0;
      media.push({ kind, url, path, name: cleanName || "Файл", size: cleanSize });
    } else {
      media.push({ kind, url, path });
    }
  }

  const rawTags: unknown[] = allowTags && Array.isArray(raw.tags) ? raw.tags : [];
  if (rawTags.length > MAX_POST_TAGS) {
    return { ok: false, error: `Хамгийн ихдээ ${MAX_POST_TAGS} нэр цохоно.` };
  }

  // Нэг хүнийг (uid эсвэл ижил нэрээр) хоёр дахин цохохгүй
  const tags: PostTag[] = [];
  const seen = new Set<string>();
  for (const item of rawTags) {
    const { uid: tagUid, name } = (item ?? {}) as Record<string, unknown>;
    const cleanName =
      typeof name === "string"
        ? name.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_POST_TAG_NAME)
        : "";
    const cleanUid = typeof tagUid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(tagUid) ? tagUid : null;
    if (!cleanName) continue;
    const key = cleanUid ?? `name:${cleanName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push({ uid: cleanUid, name: cleanName });
  }

  if (!body && media.length === 0 && !videoLink && tags.length === 0) {
    return { ok: false, error: "Бичвэр, зураг эсвэл бичлэг оруулна уу." };
  }

  return { ok: true, value: { body, media, videoLink, period, tags } };
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
  tags: posts.tags,
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
