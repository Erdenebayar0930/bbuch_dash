import "server-only";

const MAX_NAME = 120;
const MAX_TEXT = 300;

export type DonationBoxPatch = {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  note?: string;
  active?: boolean;
};

export type ParsedDonationBox =
  | { ok: true; value: DonationBoxPatch }
  | { ok: false; error: string };

const invalid = (error: string): ParsedDonationBox => ({ ok: false, error });

/**
 * Хандивын хайрцгийн өгөгдлийг шалгана.
 *
 * `partial: true` үед зөвхөн ирсэн талбарыг шалгана — үүсгэх (нэр ба координат
 * заавал) ба засах (хэсэгчилсэн) хоёрт хоёуланд нь ашиглагдана.
 */
export function readDonationBox(
  body: unknown,
  partial: boolean
): ParsedDonationBox {
  if (typeof body !== "object" || body === null) {
    return invalid("Өгөгдөл буруу байна.");
  }

  const input = body as Record<string, unknown>;
  const patch: DonationBoxPatch = {};

  if (input.name !== undefined || !partial) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) return invalid("Хайрцгийн нэрийг оруулна уу.");
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
    if (value.length > MAX_TEXT) {
      return invalid(`Утга ${MAX_TEXT} тэмдэгтээс урт байж болохгүй.`);
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

  if (input.active !== undefined) {
    if (typeof input.active !== "boolean") {
      return invalid("active нь true/false байх ёстой.");
    }
    patch.active = input.active;
  }

  return { ok: true, value: patch };
}