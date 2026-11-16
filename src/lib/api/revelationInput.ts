import "server-only";

import { eq } from "drizzle-orm";

import {
  DEFAULT_REVELATION_SOURCE,
  MAX_REVELATION_IMAGES,
  MAX_REVELATION_LENGTH,
  MAX_REVELATION_SOURCE_LENGTH,
} from "@/data/revelationOptions";
import { db } from "@/lib/db";
import { revelations, users } from "@/lib/db/schema";

export type RevelationImage = { url: string; path: string };

const STORAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

function isStorageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && STORAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

type Parsed =
  | { ok: true; value: { body: string; receivedBy: string; images: RevelationImage[] } }
  | { ok: false; error: string };

/**
 * Нийтлэлийн бичвэр ба зургийг шалгана.
 *
 * Шинэ зураг нь ЗӨВХӨН илгээгчийн `revelations/{uid}/` хавтаст байна —
 * өөр хүний файлыг холбож, дараа нь устгуулахаас сэргийлнэ. Засварт өмнө нь
 * хавсаргасан зургаа (`keepPaths`) хэвээр үлдээж болно.
 */
export function readRevelation(
  input: unknown,
  uid: string,
  keepPaths: readonly string[] = []
): Parsed {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Хүсэлтийн бие буруу байна." };
  }

  const raw = input as Record<string, unknown>;
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const rawImages: unknown[] = Array.isArray(raw.images) ? raw.images : [];
  // Хоосон бол тогтмол нэр — «Илчлэл авсан» хэзээ ч хоосон гарахгүй
  const receivedBy =
    (typeof raw.receivedBy === "string" ? raw.receivedBy.trim() : "") ||
    DEFAULT_REVELATION_SOURCE;

  if (body.length > MAX_REVELATION_LENGTH) {
    return {
      ok: false,
      error: `Нийтлэл ${MAX_REVELATION_LENGTH} тэмдэгтээс урт байж болохгүй.`,
    };
  }
  if (receivedBy.length > MAX_REVELATION_SOURCE_LENGTH) {
    return {
      ok: false,
      error: `Илчлэл авсан хүний нэр ${MAX_REVELATION_SOURCE_LENGTH} тэмдэгтээс урт байж болохгүй.`,
    };
  }
  if (rawImages.length > MAX_REVELATION_IMAGES) {
    return { ok: false, error: `Хамгийн ихдээ ${MAX_REVELATION_IMAGES} зураг оруулна.` };
  }

  const ownPrefix = `revelations/${uid}/`;
  const images: RevelationImage[] = [];

  for (const item of rawImages) {
    const url = (item as { url?: unknown })?.url;
    const path = (item as { path?: unknown })?.path;

    if (
      typeof url !== "string" ||
      typeof path !== "string" ||
      !isStorageUrl(url) ||
      path.includes("..") ||
      !(path.startsWith(ownPrefix) || keepPaths.includes(path))
    ) {
      return { ok: false, error: "Зургийн мэдээлэл буруу байна." };
    }
    images.push({ url, path });
  }

  if (!body && images.length === 0) {
    return { ok: false, error: "Бичвэр эсвэл зураг оруулна уу." };
  }

  return { ok: true, value: { body, receivedBy, images } };
}

/** Илчлэлийн хүснэгт — `public.revelations` эсвэл `tahilt.revelations` */
type RevelationTable = typeof revelations;

/** Жагсаалтын багана — бичсэн хүний нэр, зурагтай хамт */
export const revelationColumns = (table: RevelationTable) =>
  ({
    id: table.id,
    aimag: table.aimag,
    authorUid: table.authorUid,
    authorFirstName: users.firstName,
    authorLastName: users.lastName,
    authorPhotoUrl: users.photoUrl,
    body: table.body,
    receivedBy: table.receivedBy,
    images: table.images,
    createdAt: table.createdAt,
    updatedAt: table.updatedAt,
  }) as const;

/** Нэг нийтлэлийг жагсаалтын хэлбэрээр уншина. */
export async function readRevelationRow(table: RevelationTable, id: string) {
  const [row] = await db
    .select(revelationColumns(table))
    .from(table)
    .leftJoin(users, eq(table.authorUid, users.uid))
    .where(eq(table.id, id))
    .limit(1);

  return row ?? null;
}
