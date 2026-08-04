import "server-only";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { adminAuth } from "@/lib/firebaseAdmin";
import { asRole, isAdminRole, isSuperRole } from "@/lib/permissions";

import type { NextRequest } from "next/server";
import type { UserRow } from "@/lib/db/schema";
import type { Actor } from "@/lib/permissions";

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
 * Authorization: Bearer <idToken> толгойг Firebase-ээр шалгаж,
 * Postgres дэх бүртгэлтэй нь хамт буцаана. Токен буруу бол null.
 */
export async function getCaller(request: NextRequest): Promise<Caller | null> {
  const header = request.headers.get("authorization") ?? "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!idToken) return null;

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);

    // Мөр байхгүй бол ЭНД үүсгэхгүй — бүртгэлийг зөвхөн /api/auth/register
    // үүсгэнэ. Тэр route нь анхны хэрэглэгчийг super/active, бусдыг
    // user/pending болгодог. Энд авто-үүсгэвэл тэр шатлал бүхэлдээ тойрогдож,
    // Firebase дээр бүртгүүлсэн хэн ч шууд идэвхтэй эрх авна.
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.uid, decoded.uid))
      .limit(1);

    return {
      uid: decoded.uid,
      email: decoded.email ?? user?.email ?? "",
      user: user ?? null,
    };
  } catch (error) {
    console.warn("ID token шалгахад алдаа гарлаа:", error);
    return null;
  }
}

/** Нэвтэрсэн бөгөөд идэвхтэй хэрэглэгч эсэхийг шаардана. */
export async function requireActiveUser(request: NextRequest) {
  const caller = await getCaller(request);

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
 * `code` нь клиентэд зориулсан машин уншигдах шалтгаан.
 * "account-blocked" | "account-pending" | "no-profile" гэсэн кодууд ирвэл
 * apiClient сессийг шууд таслана — эрх хаагдсан хэрэглэгч үлдэхгүй.
 */
export const forbidden = (message = "Эрх хүрэлцэхгүй.", code?: string) =>
  NextResponse.json({ error: message, code }, { status: 403 });

export const badRequest = (message: string) =>
  NextResponse.json({ error: message }, { status: 400 });

export const serverError = (error: unknown, fallback: string) => {
  console.error(fallback, error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 }
  );
};
