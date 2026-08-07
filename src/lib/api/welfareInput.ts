import "server-only";

const MAX_NAME = 120;
const MAX_PHONE = 40;
const MAX_NOTE = 500;
/** Нэг өрхийн гишүүдийн боломжит дээд тоо */
const MAX_FAMILY = 50;

export type WelfarePatch = {
  name?: string;
  phone?: string;
  familySize?: number;
  note?: string;
  lat?: number;
  lng?: number;
  active?: boolean;
};

export type ParsedWelfare =
  | { ok: true; value: WelfarePatch }
  | { ok: false; error: string };

const invalid = (error: string): ParsedWelfare => ({ ok: false, error });

/**
 * Халамжийн өрхийн өгөгдлийг шалгана.
 *
 * `partial: true` үед зөвхөн ирсэн талбарыг шалгана — үүсгэх (нэр ба координат
 * заавал) ба засах (хэсэгчилсэн) хоёрт хоёуланд нь ашиглагдана.
 */
export function readWelfareHousehold(
  body: unknown,
  partial: boolean
): ParsedWelfare {
  if (typeof body !== "object" || body === null) {
    return invalid("Өгөгдөл буруу байна.");
  }

  const input = body as Record<string, unknown>;
  const patch: WelfarePatch = {};

  if (input.name !== undefined || !partial) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) return invalid("Нэрийг оруулна уу.");
    if (name.length > MAX_NAME) {
      return invalid(`Нэр ${MAX_NAME} тэмдэгтээс урт байж болохгүй.`);
    }
    patch.name = name;
  }

  if (input.phone !== undefined) {
    if (typeof input.phone !== "string") {
      return invalid("Утас текст байх ёстой.");
    }
    const phone = input.phone.trim();
    if (phone.length > MAX_PHONE) {
      return invalid(`Утас ${MAX_PHONE} тэмдэгтээс урт байж болохгүй.`);
    }
    patch.phone = phone;
  }

  if (input.note !== undefined) {
    if (typeof input.note !== "string") {
      return invalid("Тайлбар текст байх ёстой.");
    }
    const note = input.note.trim();
    if (note.length > MAX_NOTE) {
      return invalid(`Тайлбар ${MAX_NOTE} тэмдэгтээс урт байж болохгүй.`);
    }
    patch.note = note;
  }

  if (input.familySize !== undefined) {
    const size = input.familySize;
    if (
      typeof size !== "number" ||
      !Number.isInteger(size) ||
      size < 0 ||
      size > MAX_FAMILY
    ) {
      return invalid(`Гэр бүлийн тоо 0-${MAX_FAMILY} хооронд бүхэл тоо байна.`);
    }
    patch.familySize = size;
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

  if (input.active !== undefined) {
    if (typeof input.active !== "boolean") {
      return invalid("active нь true/false байх ёстой.");
    }
    patch.active = input.active;
  }

  return { ok: true, value: patch };
}