import "server-only";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { adminAuth } from "@/lib/firebaseAdmin";
import { asRole, isAdminRole, isSuperRole } from "@/lib/permissions";
import { backfillClaimsIfStale } from "./claims";

import type { NextRequest } from "next/server";
import type { UserRow } from "@/lib/db/schema";
import type { Actor, UserStatus } from "@/lib/permissions";

export type Caller = {
  uid: string;
  email: string;
  /** Postgres дэх бүртгэл — анх бүртгүүлж буй хэрэглэгчид байхгүй байж болно */
  user: UserRow | null;
};

export { isAdminRole, isSuperRole };

/** Эрхийн шалгалтад дамжуулах хэлбэрт буулгана. */
export const toActor = (caller: Caller): Actor => ({
  uid: caller.uid,
  role: asRole(caller.user?.role),
});

/**
 * Сервер талын дэд бүтэц ажиллахгүй байна — токен буруу гэсэн үг БИШ.
 *
 * Энэ ялгаа чухал: хоёуланг нь нэг дор барьж "нэвтрээгүй" гэж хариулбал
 * өгөгдлийн сан унасан үед хэрэглэгчид "та нэвтрээгүй байна" гэж ХУДАЛ
 * хэлж, жинхэнэ шалтгааныг бүрэн нуудаг.
 */
export class ServiceUnavailableError extends Error {
  constructor(cause: unknown) {
    super("Сервер өгөгдлийн сан руу хандаж чадсангүй.");
    this.name = "ServiceUnavailableError";
    this.cause = cause;
  }
}

/**
 * Authorization: Bearer <idToken> толгойг Firebase-ээр шалгаж,
 * MySQL дэх бүртгэлтэй нь хамт буцаана.
 *
 * `null` = токен байхгүй эсвэл хүчингүй (жинхэнэ эрхийн алдаа).
 * `ServiceUnavailableError` шидэгдэнэ = токен ЗӨВ байсан ч сангаас уншиж
 * чадсангүй. Дуудагч эдгээрийг ялгаж, 401 болон 503-ыг зөв буцаана.
 */
export async function getCaller(request: NextRequest): Promise<Caller | null> {
  const header = request.headers.get("authorization") ?? "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!idToken) return null;

  let decoded;

  try {
    decoded = await adminAuth().verifyIdToken(idToken);
  } catch (error) {
    console.warn("ID token шалгахад алдаа гарлаа:", error);
    return null;
  }

  // Мөр байхгүй бол ЭНД үүсгэхгүй — бүртгэлийг зөвхөн /api/auth/register
  // үүсгэнэ. Тэр route нь анхны хэрэглэгчийг super/active, бусдыг
  // user/pending болгодог. Энд авто-үүсгэвэл тэр шатлал бүхэлдээ тойрогдож,
  // Firebase дээр бүртгүүлсэн хэн ч шууд идэвхтэй эрх авна.
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.uid, decoded.uid))
      .limit(1);

    // Токен доторх эрхийн хуулбарыг MySQL-тэй тааруулна. Firebase Storage-ийн
    // дүрэм ЗӨВХӨН токеныг харж чаддаг тул энэ хуулбар шинэ байх ёстой.
    // Хүлээхгүй (await хийхгүй): хэрэглэгчийн хүсэлтийг Firebase-ийн хариу
    // хүлээлгэх шалтгаан байхгүй бөгөөд амжилтгүй болсон ч API-ийн эрх нь
    // доорх MySQL мөрөөр шийдэгдэнэ.
    if (user) {
      void backfillClaimsIfStale(decoded, {
        role: asRole(user.role),
        status: (user.status ?? "pending") as UserStatus,
      });
    }

    return {
      uid: decoded.uid,
      email: decoded.email ?? user?.email ?? "",
      user: user ?? null,
    };
  } catch (error) {
    // Токен зөв байсан — буруутай нь сан. 401 буцаах нь худал мэдээлэл болно.
    throw new ServiceUnavailableError(error);
  }
}

/**
 * `getCaller`-ыг дуудаад дэд бүтцийн гэмтлийг 503 болгож хувиргана.
 *
 * Route бүр try/catch бичихээс сэргийлж нэг дор баглав.
 */
export async function getCallerOrResponse(
  request: NextRequest
): Promise<{ caller: Caller | null } | { error: NextResponse }> {
  try {
    return { caller: await getCaller(request) };
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return { error: serviceUnavailable(error) };
    }
    throw error;
  }
}

/** Нэвтэрсэн бөгөөд идэвхтэй хэрэглэгч эсэхийг шаардана. */
export async function requireActiveUser(request: NextRequest) {
  const result = await getCallerOrResponse(request);

  if ("error" in result) return result;

  const { caller } = result;

  if (!caller) {
    return { error: unauthorized() } as const;
  }

  if (!caller.user) {
    return {
      error: forbidden("Таны бүртгэл олдсонгүй.", "no-profile"),
    } as const;
  }

  if (caller.user.status !== "active") {
    // Төлөвийг код руу оруулснаар клиент "хаагдсан" эсвэл "хүлээгдэж буй"
    // гэдгийг ялгаж, зөв тайлбартай хуудас руу гаргана
    return {
      error: forbidden(
        "Таны бүртгэл идэвхгүй байна.",
        `account-${caller.user.status}`
      ),
    } as const;
  }

  return { caller } as const;
}

/** Идэвхтэй админ (admin | super) эсэхийг шаардана. */
export async function requireAdmin(request: NextRequest) {
  const result = await requireActiveUser(request);

  if ("error" in result) return result;

  if (!isAdminRole(result.caller.user?.role)) {
    return { error: forbidden("Зөвхөн админ хийх боломжтой үйлдэл.") } as const;
  }

  return result;
}

/**
 * Тухайн аймагт харьяалагдах эсэхийг шаардана.
 *
 * Админ ба super бүх аймагт нэвтэрнэ — тэд бүхнийг хянадаг. Цэс нуух нь
 * зөвхөн UI; жинхэнэ хаалт нь ЭНЭ функц: хаягаар нь шууд орсон ч, API руу
 * гараар хүсэлт явуулсан ч аймгийн гишүүн биш бол өгөгдөл гарахгүй.
 */
export async function requireAimag(request: NextRequest, aimag: string) {
  const result = await requireActiveUser(request);

  if ("error" in result) return result;
  if (isAdminRole(result.caller.user?.role)) return result;

  const aimags = result.caller.user?.aimags ?? [];

  if (!aimags.includes(aimag)) {
    return {
      error: forbidden("Энэ хэсэг таны харьяалагдах аймагт хамаарахгүй."),
    } as const;
  }

  return result;
}

/** Зөвхөн супер админ — эрх олгох зэрэг шатлал өөрчлөх үйлдэлд. */
export async function requireSuper(request: NextRequest) {
  const result = await requireActiveUser(request);

  if ("error" in result) return result;

  if (!isSuperRole(result.caller.user?.role)) {
    return {
      error: forbidden("Зөвхөн супер админ хийх боломжтой үйлдэл."),
    } as const;
  }

  return result;
}

export const unauthorized = () =>
  NextResponse.json({ error: "Нэвтрээгүй байна." }, { status: 401 });

/**
 * 503 — сервер түр ажиллахгүй.
 *
 * 401 БИШ гэдэг нь чухал: apiClient нь 403-д л сессийг тасалдаг тул хэрэглэгч
 * гарахгүй, харин юу болсныг ил хэлнэ. Сан сэргэмэгц дараагийн шалгалт
 * өөрөө амжилттай болно.
 */
export const serviceUnavailable = (error: unknown) => {
  console.error("Өгөгдлийн сан руу хандаж чадсангүй:", error);

  return NextResponse.json(
    {
      error:
        "Сервер өгөгдлийн сан руу хандаж чадсангүй. Түр хүлээгээд дахин оролдоно уу.",
      code: "service-unavailable",
    },
    {
      status: 503,
      // Дахин оролдох хугацааг ил хэлнэ — хөтөч, хяналтын хэрэгслүүд хүндэтгэнэ
      headers: { "Retry-After": "5" },
    }
  );
};

/**
 * Алдаа нь ТҮР ЗУУРЫН хэт ачаалал мөн үү (кодын алдаа биш).
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ: холболтын дараалал дүүрэхэд mysql2 нь ЗӨВХӨН
 * `Error("Queue limit reached.")` шиднэ — `code` талбаргүй. Ялгаж
 * танихгүй бол энэ нь 500 болж буцна: клиент "апп эвдэрсэн" гэж ойлгоод
 * дахин оролдохгүй, лог нь жинхэнэ програмын алдаануудтай холилдоно.
 * Бодит байдал дээр энэ нь зүгээр л "одоо завгүй байна" гэсэн үг —
 * хэдхэн секундын дараа өөрөө засагдана.
 */
const OVERLOAD_CODES = new Set([
  "ER_CON_COUNT_ERROR",
  "ER_USER_LIMIT_REACHED",
  "ER_TOO_MANY_USER_CONNECTIONS",
  "ETIMEDOUT",
  "PROTOCOL_SEQUENCE_TIMEOUT",
]);

export function isOverloadError(error: unknown): boolean {
  if (!error) return false;

  const code = (error as { code?: string }).code;
  if (code && OVERLOAD_CODES.has(code)) return true;

  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Queue limit reached");
}

/**
 * `code` нь клиентэд зориулсан машин уншигдах шалтгаан.
 * "account-blocked" | "account-pending" | "no-profile" гэсэн кодууд ирвэл
 * apiClient сессийг шууд таслана — эрх хаагдсан хэрэглэгч үлдэхгүй.
 */
export const forbidden = (message = "Эрх хүрэлцэхгүй.", code?: string) =>
  NextResponse.json({ error: message, code }, { status: 403 });

export const badRequest = (message: string) =>
  NextResponse.json({ error: message }, { status: 400 });

/**
 * 500 — дотоод алдаа. Клиентэд ЗӨВХӨН `fallback` тайлбарыг буцаана.
 *
 * ⚠ Өмнө нь `error.message`-ийг шууд буцаадаг байв. Drizzle нь SQL алдааг
 * "Failed query: select `users`.`uid` … from `users` where …" гэсэн бүтэн
 * асуулгатай нь боож шиддэг тул халдагч зориудаар алдаа үүсгээд хүснэгт,
 * баганы нэр, холболтын мэдээллийг цуглуулж, өгөгдлийн сангийн бүтцийг
 * зурж авах боломжтой байсан. Дэлгэрэнгүй нь серверийн лог руу л явна.
 */
export const serverError = (error: unknown, fallback: string) => {
  /**
   * Хэт ачааллыг 500 биш 503 болгоно. Хоёрын ялгаа хэрэглэгчид ч, лог
   * шинжлэхэд ч чухал: 500 = "энэ хүсэлт хэзээ ч ажиллахгүй", 503 = "одоо
   * завгүй, дахин оролдоорой".
   */
  if (isOverloadError(error)) return serviceUnavailable(error);

  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
};
