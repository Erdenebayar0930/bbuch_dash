import "server-only";

import { isStoredFileUrl } from "@/lib/storageUrl";

const MAX_NAME = 120;
const MAX_TEXT = 300;
/** Харуулын байршлын тайлбар — зурагтай хамт урт бичвэр бичнэ */
export const GUARD_NOTE_LIMIT = 5000;

/** Нэг байршилд хавсаргах зургийн дээд тоо */
const MAX_IMAGES = 10;

export type DonationBoxPatch = {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  note?: string;
  active?: boolean;
  images?: { url: string; path: string }[];
};

export type ParsedDonationBox =
  | { ok: true; value: DonationBoxPatch }
  | { ok: false; error: string };

const invalid = (error: string): ParsedDonationBox => ({ ok: false, error });

/**
 * Хандивын хайрцаг ба харуулын цэгийн өгөгдлийг шалгана (талбар нь ижил).
 *
 * `partial: true` үед зөвхөн ирсэн талбарыг шалгана — үүсгэх (нэр ба координат
 * заавал) ба засах (хэсэгчилсэн) хоёрт хоёуланд нь ашиглагдана.
 */
export function readDonationBox(
  body: unknown,
  partial: boolean,
  /** Нэр хоосон үеийн алдаа — харуулын цэг ч энэ шалгалтыг ашиглана */
  nameRequired = "Хайрцгийн нэрийг оруулна уу.",
  /** Харуулын байршил — урт тайлбар ба зураг (`guard_points/{uid}/`) */
  options: { noteLimit?: number; imagesOwner?: string; keepPaths?: readonly string[] } = {}
): ParsedDonationBox {
  if (typeof body !== "object" || body === null) {
    return invalid("Өгөгдөл буруу байна.");
  }

  const input = body as Record<string, unknown>;
  const patch: DonationBoxPatch = {};

  if (input.name !== undefined || !partial) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) return invalid(nameRequired);
    if (name.length > MAX_NAME) {
      return invalid(`Нэр ${MAX_NAME} тэмдэгтээс урт байж болохгүй.`);
    }
    patch.name = name;
  }

  for (const key of ["address", "note"] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== "string") {
      return invalid("Хаяг ба тэмдэглэл текст байх ёстой.");
    }

    const value = (input[key] as string).trim();
    const limit = key === "note" && options.noteLimit ? options.noteLimit : MAX_TEXT;
    if (value.length > limit) {
      return invalid(`Утга ${limit} тэмдэгтээс урт байж болохгүй.`);
    }
    patch[key] = value;
  }

  // Дэлхийн координатын хүрээ — андуурч солигдсон lat/lng-ийг барина
  for (const [key, limit] of [
    ["lat", 90],
    ["lng", 180],
  ] as const) {
    if (input[key] === undefined) {
      if (partial) continue;
      return invalid("Байршлыг газрын зураг дээрээс сонгоно уу.");
    }

    const value = input[key];
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      Math.abs(value) > limit
    ) {
      return invalid("Байршлын координат буруу байна.");
    }
    patch[key] = value;
  }

  // Зургууд — зөвхөн харуулын байршилд (imagesOwner заасан үед)
  if (options.imagesOwner !== undefined && input.images !== undefined) {
    if (!Array.isArray(input.images) || input.images.length > MAX_IMAGES) {
      return invalid(`Хамгийн ихдээ ${MAX_IMAGES} зураг оруулна.`);
    }
    const own = `guard_points/${options.imagesOwner}/`;
    const images: { url: string; path: string }[] = [];
    for (const item of input.images) {
      const { url, path } = (item ?? {}) as Record<string, unknown>;
      if (
        typeof url !== "string" ||
        typeof path !== "string" ||
        !isStoredFileUrl(url) ||
        path.includes("..") ||
        !(path.startsWith(own) || (options.keepPaths ?? []).includes(path))
      ) {
        return invalid("Зургийн мэдээлэл буруу байна.");
      }
      images.push({ url, path });
    }
    patch.images = images;
  }

  if (input.active !== undefined) {
    if (typeof input.active !== "boolean") {
      return invalid("active нь true/false байх ёстой.");
    }
    patch.active = input.active;
  }

  return { ok: true, value: patch };
}