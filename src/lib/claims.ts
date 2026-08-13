"use client";

import { auth } from "./firebase";

/**
 * Firebase токен доторх эрхийн хуулбарыг MySQL-тэй тааруулна.
 *
 * Сервер нь эрх/төлөв өөрчлөгдөх бүрд custom claim бичдэг ч, ХӨТӨЧ дэх токен
 * нь тэр агшинд шинэчлэгддэггүй — байгалийн сэргээлт хүртэл (ихдээ 1 цаг)
 * хуучин утгаа барина. Firebase Storage-ийн дүрэм зөвхөн токеныг хардаг тул
 * дөнгөж админ болсон хүн нэг цагийн турш зураг байршуулж чадахгүй байна.
 *
 * Тиймээс зөрүү илрэх бүрд токеныг албадан сэргээнэ. Зөрүүгүй үед юу ч
 * хийхгүй — AdminGuard энэ функцийг 60 секунд тутам дууддаг тул болгонд нь
 * сэргээвэл дэмий сүлжээний хүсэлт болно.
 *
 * ⚠ Энэ нь хамгаалалт БИШ, зөвхөн хурдасгагч. Claim-ийг хэрэглэгч өөрөө
 * зохиож чадахгүй (токеныг Firebase гарын үсэглэдэг) ба жинхэнэ эрхийн
 * шалгалт нь сервер дээр MySQL-ээс уншиж хийгддэг.
 */
let lastForcedRefresh = 0;

/**
 * Хоёр албадсан сэргээлтийн хоорондох доод зай.
 *
 * Сервер claim бичиж чадахгүй байвал (жишээ нь service account түлхүүр
 * буруу) зөрүү нь ХЭЗЭЭ Ч арилахгүй. Хөрөлтгүй бол AdminGuard-ийн 60
 * секунд тутмын шалгалт бүр токен сэргээх хүсэлт үүсгэж, Firebase-ийн
 * квотыг дэмий иднэ. Гурван минут нь эрхийн өөрчлөлт хүрэхэд хангалттай
 * хурдан, давталт болоход хангалттай удаан.
 */
const REFRESH_COOLDOWN_MS = 3 * 60_000;

export async function refreshClaimsIfStale(
  role: string | null | undefined,
  status: string | null | undefined
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // Кэшлэгдсэн токеныг задалж уншина — сүлжээ ашиглахгүй
    const { claims } = await user.getIdTokenResult();

    if (claims.role === role && claims.status === status) return;

    const now = Date.now();
    if (now - lastForcedRefresh < REFRESH_COOLDOWN_MS) return;
    lastForcedRefresh = now;

    // `true` = серверээс шинэ токен албадан авна
    await user.getIdToken(true);
  } catch (error) {
    // Сэргээж чадсангүй гэдэг нь эрхийн алдаа биш — дараагийн шалгалтаар
    // дахин оролдоно. Хэрэглэгчийг гаргах шалтгаан болохгүй.
    console.warn("Токены эрхийг шинэчилж чадсангүй:", error);
  }
}
