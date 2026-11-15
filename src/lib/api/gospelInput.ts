import "server-only";

import { eq } from "drizzle-orm";

import { isGospelAimag, MIN_BIRTH_YEAR } from "@/data/gospelOptions";
import { genders, isValidOption } from "@/data/profileOptions";
import { db } from "@/lib/db";
import { gospelAreas, gospelContacts, users } from "@/lib/db/schema";

export type GospelInput = {
  name?: string;
  phone?: string;
  gender?: string;
  birthYear?: number;
  address?: string;
  holySpiritBaptismDate?: string;
  waterBaptismDate?: string;
  note?: string;
  photoUrl?: string;
  photoPath?: string;
  aimag?: string;
  areaId?: string;
};

type Parsed = { ok: true; value: GospelInput } | { ok: false; error: string };

type PhotoContext = {
  /** Хүсэлт явуулсан хэрэглэгч — шинэ зураг нь түүний хавтаст байх ёстой */
  uid: string;
  /** Засвар үед одоо байгаа зургийн зам — өөрчлөхгүй үлдээж болно */
  currentPath?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** YYYY-MM-DD эсвэл хоосон (хүлээж аваагүй) */
const isDateOrEmpty = (value: string) => {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
};

/** Текст талбар ба түүний дээд урт */
const TEXT_LIMITS = { name: 255, phone: 32, address: 255, note: 2000 } as const;

const DATE_FIELDS = ["holySpiritBaptismDate", "waterBaptismDate"] as const;

const DATE_LABELS: Record<(typeof DATE_FIELDS)[number], string> = {
  holySpiritBaptismDate: "Ариун сүнсний баптисмын огноо",
  waterBaptismDate: "Усан баптисмын огноо",
};

/**
 * Хүсэлтийн биеийг шалгаж, зөвхөн зөв талбаруудыг буцаана.
 *
 * `partial` үед (засвар) ирээгүй талбарыг алгасна; эс бөгөөс нэр, аймаг,
 * ангилал заавал байна.
 */
export function readGospelContact(
  body: unknown,
  partial: boolean,
  photo: PhotoContext
): Parsed {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Хүсэлтийн бие буруу байна." };
  }

  const input = body as Record<string, unknown>;
  const value: GospelInput = {};

  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    const raw = input[key];
    if (raw === undefined) continue;
    if (typeof raw !== "string") return { ok: false, error: `${key} нь текст байна.` };

    const trimmed = raw.trim();
    if (trimmed.length > limit) {
      return { ok: false, error: `${key} ${limit} тэмдэгтээс урт байж болохгүй.` };
    }
    value[key as keyof typeof TEXT_LIMITS] = trimmed;
  }

  if (value.name !== undefined && value.name === "") {
    return { ok: false, error: "Овог нэрээ оруулна уу." };
  }

  if (input.gender !== undefined) {
    if (
      typeof input.gender !== "string" ||
      (input.gender !== "" && !isValidOption(genders, input.gender))
    ) {
      return { ok: false, error: "Хүйс буруу байна." };
    }
    value.gender = input.gender;
  }

  if (input.birthYear !== undefined) {
    const year = input.birthYear;
    const thisYear = new Date().getFullYear();
    if (
      typeof year !== "number" ||
      !Number.isInteger(year) ||
      (year !== 0 && (year < MIN_BIRTH_YEAR || year > thisYear))
    ) {
      return {
        ok: false,
        error: `Төрсөн он ${MIN_BIRTH_YEAR}-${thisYear} хооронд байна.`,
      };
    }
    value.birthYear = year;
  }

  for (const key of DATE_FIELDS) {
    const raw = input[key];
    if (raw === undefined) continue;
    if (typeof raw !== "string" || !isDateOrEmpty(raw)) {
      return { ok: false, error: `${DATE_LABELS[key]} YYYY-MM-DD хэлбэртэй байна.` };
    }
    value[key] = raw;
  }

  // Зураг: url ба зам хамт ирнэ. Хоёулаа хоосон = зураггүй. Шинэ зураг нь
  // ЗӨВХӨН илгээгчийн хавтаст байна — өөр хүний файлыг холбож, дараа нь
  // устгуулахаас сэргийлнэ. Засварт хуучин зургаа хэвээр үлдээж болно.
  if (input.photoUrl !== undefined || input.photoPath !== undefined) {
    const url = input.photoUrl;
    const path = input.photoPath;

    if (typeof url !== "string" || typeof path !== "string") {
      return { ok: false, error: "Зургийн мэдээлэл буруу байна." };
    }

    if (url !== "" || path !== "") {
      const ownFolder = path.startsWith(`gospel/${photo.uid}/`);
      const unchanged = !!photo.currentPath && path === photo.currentPath;

      if (
        !isStorageUrl(url) ||
        path.includes("..") ||
        path.length > 512 ||
        url.length > 1024 ||
        !(ownFolder || unchanged)
      ) {
        return { ok: false, error: "Зургийн мэдээлэл буруу байна." };
      }
    }

    value.photoUrl = url;
    value.photoPath = path;
  }

  if (input.areaId !== undefined) {
    if (typeof input.areaId !== "string" || !UUID.test(input.areaId)) {
      return { ok: false, error: "Ангилал буруу байна." };
    }
    value.areaId = input.areaId;
  }

  if (input.aimag !== undefined) {
    if (!isGospelAimag(input.aimag)) return { ok: false, error: "Аймаг буруу байна." };
    value.aimag = input.aimag;
  }

  if (!partial) {
    if (!value.name) return { ok: false, error: "Овог нэрээ оруулна уу." };
    if (!value.aimag) return { ok: false, error: "Аймгаа заана уу." };
    if (!value.areaId) return { ok: false, error: "Ангиллаа сонгоно уу." };
  }

  return { ok: true, value };
}

/** Бүртгэгчийн нэртэй хамт уншина — жагсаалт ба засварын хариунд */
export const gospelSelection = {
  id: gospelContacts.id,
  name: gospelContacts.name,
  phone: gospelContacts.phone,
  gender: gospelContacts.gender,
  birthYear: gospelContacts.birthYear,
  address: gospelContacts.address,
  holySpiritBaptismDate: gospelContacts.holySpiritBaptismDate,
  waterBaptismDate: gospelContacts.waterBaptismDate,
  sharedOn: gospelContacts.sharedOn,
  note: gospelContacts.note,
  photoUrl: gospelContacts.photoUrl,
  photoPath: gospelContacts.photoPath,
  aimag: gospelContacts.aimag,
  areaId: gospelContacts.areaId,
  sharedBy: gospelContacts.sharedBy,
  sharedByFirstName: users.firstName,
  sharedByLastName: users.lastName,
  createdAt: gospelContacts.createdAt,
};

/** Улаанбаатарын өнөөдөр, YYYY-MM-DD — бүртгэсэн өдөр */
export const todayInUlaanbaatar = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar" }).format(
    new Date()
  );

/**
 * Бүртгэл хавсаргаж болох ангилал мөн эсэх — байх ёстой бөгөөд задаргаатай
 * табыг шууд сонгохгүй (задаргааных нь аль нэгийг сонгоно).
 */
export async function checkContactArea(areaId: string): Promise<string | null> {
  const [area] = await db
    .select({ id: gospelAreas.id })
    .from(gospelAreas)
    .where(eq(gospelAreas.id, areaId))
    .limit(1);

  if (!area) return "Ангилал олдсонгүй.";

  const [child] = await db
    .select({ id: gospelAreas.id })
    .from(gospelAreas)
    .where(eq(gospelAreas.parentId, areaId))
    .limit(1);

  return child ? "Задаргааны аль нэгийг сонгоно уу." : null;
}
