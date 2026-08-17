"use client";

import { auth } from "./firebase";
import { forceSignOut, reasonFromCode } from "./session";

/**
 * Сервер талын API руу хандах нийтлэг туслах.
 *
 * Postgres-т browser-оос шууд холбогдох боломжгүй тул бүх өгөгдлийн үйлдэл
 * /api/... route-оор дамжина. Хэрэглэгчийг Firebase ID token-оор танина.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth: needsAuth = true } = options;

  const headers: Record<string, string> = {};

  if (needsAuth) {
    /**
     * Firebase сессээ сэргээх хүртэл ХҮЛЭЭНЭ.
     *
     * ⚠ `auth.currentUser` нь хуудас ачаалагдмагц ХООСОН байдаг: Firebase нь
     * сессээ IndexedDB-ээс асинхроноор сэргээдэг. Шууд шалгавал бүтэн хуудас
     * ачаалагдах бүрд (жишээ нь гаднаас буцаж ирэх, F5 дарах) эхний хүсэлтүүд
     * "Нэвтэрсэн байх шаардлагатай" гэж ХУДАЛ унана — хэрэглэгч нэвтэрсэн
     * хэвээр байхад. Энэ нь Google-ийн зөвшөөрлөөс буцаж ирэхэд амжилтын
     * мессежтэй зэрэг алдаа гарч байсны шалтгаан байв.
     *
     * `authStateReady()` нь анхны төлөв тодрох хүртэл хүлээгээд шийднэ.
     */
    await auth.authStateReady();

    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("Нэвтэрсэн байх шаардлагатай.");
    }
    headers.Authorization = `Bearer ${await currentUser.getIdToken()}`;
  }

  // FormData-г JSON болгож болохгүй: Content-Type-ыг хөтөч өөрөө boundary-тай
  // нь тавина, бид гараар тавьбал сервер хэсгүүдийг нь салгаж чадахгүй болно
  const isForm = body instanceof FormData;

  if (body !== undefined && !isForm) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;

  try {
    response = await fetch(path, {
      method,
      headers,
      body:
        body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch (error) {
    console.error("Сервертэй холбогдож чадсангүй:", error);
    throw new Error("Сервертэй холбогдож чадсангүй. Холболтоо шалгана уу.");
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const { error, code } = payload as { error?: string; code?: string };

    // Эрх хаагдсан / бүртгэл устсан бол хүлээхгүйгээр сессийг тасална.
    // Ямар ч хуудсан дээр байсан дараагийн хүсэлт дээр шууд гарна.
    const reason = reasonFromCode(code);
    if (response.status === 403 && reason) {
      await forceSignOut(reason);
    }

    throw new Error(error || `Хүсэлт амжилтгүй (${response.status})`);
  }

  return payload as T;
}
