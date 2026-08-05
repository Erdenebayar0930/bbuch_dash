import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  getCaller,
  requireActiveUser,
  serverError,
  unauthorized,
} from "@/lib/api/auth";
import {
  isValidOption,
  loveLanguages,
  mbtiTypes,
  temperaments,
  type Option,
} from "@/data/profileOptions";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Хэрэглэгч өөрөө засаж болох текст талбарууд.
 *
 * `callings` ба `aimags` энд БАЙХГҮЙ — тэдгээрийг зөвхөн админ
 * /api/users/[uid] route-оор оноодог, хэрэглэгчид зөвхөн харагдана.
 */
const TEXT_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "position",
  "occupation",
  "carPlate",
  "spouseName",
] as const;

/** Зөвхөн тогтсон жагсаалтаас сонгогдох талбарууд */
const OPTION_FIELDS: Record<string, Option[]> = {
  mbti: mbtiTypes,
  loveLanguage: loveLanguages,
};

/** Темперамент бүрийн онооны дээд хязгаар */
const MAX_TEMPERAMENT_SCORE = 999;

/**
 * Темперамент нь { "sanguine": 12, ... } хэлбэртэй. Мэдэгдэхгүй төрөл,
 * бүхэл бус эсвэл сөрөг оноог хүлээж авахгүй.
 */
type TemperamentResult =
  | { ok: true; value: Record<string, number> }
  | { ok: false; error: string };

function readTemperaments(input: unknown): TemperamentResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "temperaments нь объект байх ёстой." };
  }

  const result: Record<string, number> = {};

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!isValidOption(temperaments, key) || key === "") {
      return { ok: false, error: `Темпераментийн төрөл буруу байна: ${key}` };
    }

    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > MAX_TEMPERAMENT_SCORE
    ) {
      return {
        ok: false,
        error: `${key} онооны утга 0-${MAX_TEMPERAMENT_SCORE} хооронд бүхэл тоо байна.`,
      };
    }

    result[key] = value;
  }

  return { ok: true, value: result };
}

/** YYYY-MM-DD хэлбэрийн огноо (хоосон бол бөглөөгүй) */
const DATE_FIELDS = ["spouseBirthDate"] as const;

// route.ts-ээс зөвхөн route handler export хийнэ — туслах функц дотоод байна
function isDate(value: string) {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

const STORAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

function isStoragePhotoUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && STORAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** Өөрийн профайлыг уншина. */
export async function GET(request: NextRequest) {
  const caller = await getCaller(request);
  if (!caller) return unauthorized();

  return NextResponse.json({ user: caller.user });
}

/**
 * Өөрийн профайлаа шинэчилнэ.
 * role, status-ыг энд өөрчилж болохгүй — зөвхөн админы route-аар.
 */
export async function PATCH(request: NextRequest) {
  // GET нь getCaller дээр үлддэг — клиент өөрийн төлөвөө уншиж чадах ёстой,
  // эс бөгөөс хаагдсанаа мэдэхгүй. Харин БИЧИХ эрх идэвхтэй хүнд л байна.
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const caller = result.caller;

  try {
    const body = await request.json();
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    for (const key of TEXT_FIELDS) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== "string") {
          return badRequest(`${key} нь текст байх ёстой.`);
        }
        patch[key] = body[key].trim();
      }
    }

    // Сонголттой талбарууд — зөвхөн мэдэгдэж буй утга. Хоосон мөр = сонгоогүй.
    for (const [key, options] of Object.entries(OPTION_FIELDS)) {
      if (body[key] === undefined) continue;

      if (typeof body[key] !== "string" || !isValidOption(options, body[key])) {
        return badRequest(`${key} утга буруу байна.`);
      }
      patch[key] = body[key];
    }

    for (const key of DATE_FIELDS) {
      if (body[key] === undefined) continue;

      if (typeof body[key] !== "string" || !isDate(body[key])) {
        return badRequest(`${key} нь YYYY-MM-DD хэлбэртэй байх ёстой.`);
      }
      patch[key] = body[key];
    }

    if (body.temperaments !== undefined) {
      const parsed = readTemperaments(body.temperaments);
      if (!parsed.ok) return badRequest(parsed.error);
      patch.temperaments = parsed.value;
    }

    if (body.hasCar !== undefined) {
      if (typeof body.hasCar !== "boolean") {
        return badRequest("hasCar нь true/false байна.");
      }
      patch.hasCar = body.hasCar;
      // Машингүй болговол дугаар үлдээх нь утгагүй
      if (!body.hasCar) patch.carPlate = "";
    }

    // Зөвхөн Firebase Storage-ийн хаяг зөвшөөрнө — дурын URL профайл руу
    // оруулахаас сэргийлнэ. Хоосон мөр нь зургийг авах гэсэн үг.
    if (body.photoUrl !== undefined) {
      if (typeof body.photoUrl !== "string") {
        return badRequest("photoUrl нь текст байх ёстой.");
      }
      if (body.photoUrl !== "" && !isStoragePhotoUrl(body.photoUrl)) {
        return badRequest("photoUrl нь Firebase Storage-ийн хаяг байх ёстой.");
      }
      patch.photoUrl = body.photoUrl;
    }

    if (body.khoroo !== undefined) {
      if (body.khoroo !== null && typeof body.khoroo !== "number") {
        return badRequest("khoroo нь тоо эсвэл null байна.");
      }
      patch.khoroo = body.khoroo;
    }

    if (Object.keys(patch).length === 1) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    const [updated] = await db
      .update(users)
      .set(patch)
      .where(eq(users.uid, caller.uid))
      .returning();

    return NextResponse.json({ user: updated });
  } catch (error) {
    return serverError(error, "Профайл шинэчлэхэд алдаа гарлаа");
  }
}
