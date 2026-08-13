"use client";

import { signOut } from "firebase/auth";

import { auth } from "./firebase";

/**
 * Хандах эрх хаагдсан үед сессийг нэн даруй таслах нэгдсэн цэг.
 *
 * Хэрэглэгч нэвтэрсэн байсан ч админ түүнийг хаамагц дараагийн API хүсэлт,
 * таб идэвхжих, эсвэл давтан шалгалтын аль нэг дээр энэ дуудагдана.
 */
export type RevokeReason = "blocked" | "pending" | "no-profile" | "admin";

/** Серверийн `code` талбарыг /unauthorized хуудасны шалтгаан руу буулгана */
export function reasonFromCode(code?: string | null): RevokeReason | null {
  switch (code) {
    case "account-blocked":
      return "blocked";
    case "account-pending":
      return "pending";
    case "no-profile":
      return "no-profile";
    default:
      return null;
  }
}

/**
 * Давхар дуудагдахаас сэргийлнэ — нэг мөчид олон хүсэлт зэрэг 403 авч болно.
 * Гарах үйлдэл эхэлмэгц бусад нь чимээгүй буцна.
 */
let revoking = false;

/**
 * Гарах бүх замын НЭГДСЭН цэг.
 *
 * Апп дотор гарах товч таван өөр газар байдаг (хажуугийн цэс, хэрэглэгчийн
 * цэс, эрх хаагдсан хуудас, AdminGuard, эрх цуцлагдсан үеийн автомат гаралт).
 * Тэдгээр бүрт push бүртгэлээ цуцлахыг санах нь найдваргүй — нэг нь мартагдвал
 * гарсан хэрэглэгч тэр төхөөрөмж дээрээ мэдэгдэл хүлээн авсаар байна.
 *
 * Дараалал чухал: token устгах хүсэлт нь ID token-оор баталгаажих тул
 * `signOut`-ЫН ӨМНӨ явах ёстой. localStorage цэвэрлэх нь ганцаараа хангалтгүй —
 * жинхэнэ хүргэлт нь серверийн `fcm_tokens` хүснэгтээс явдаг.
 */
export async function signOutCompletely(): Promise<void> {
  // Динамик импорт: статикаар татвал session → fcm → apiClient → session гэсэн
  // тойрог үүснэ.
  try {
    const { deleteUserFCMToken } = await import("./fcm");
    await deleteUserFCMToken();
  } catch (error) {
    console.warn("FCM token устгаж чадсангүй:", error);
  }

  try {
    await signOut(auth);
  } catch (error) {
    console.error("Гарахад алдаа гарлаа:", error);
  }

  try {
    localStorage.removeItem("fcmToken");
  } catch {
    // Хувийн горимд storage хаалттай байж болно
  }
}

export async function forceSignOut(reason: RevokeReason): Promise<void> {
  if (revoking) return;
  revoking = true;

  await signOutCompletely();

  try {
    sessionStorage.removeItem("user");
  } catch {
    // Хувийн горимд storage хаалттай байж болно — үүнээс болж зогсох хэрэггүй
  }

  // Router биш window ашиглав: энэ функц React-ийн гаднаас (apiClient) ч
  // дуудагддаг бөгөөд бүрэн дахин ачаалалт нь хуучин төлөвийг цэвэрлэнэ.
  window.location.replace(`/unauthorized?reason=${reason}`);
}
