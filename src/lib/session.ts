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

export async function forceSignOut(reason: RevokeReason): Promise<void> {
  if (revoking) return;
  revoking = true;

  try {
    await signOut(auth);
  } catch (error) {
    console.error("Гарахад алдаа гарлаа:", error);
  }

  try {
    sessionStorage.removeItem("user");
    // Хаагдсан хэрэглэгч рүү push үргэлжлүүлэн очих ёсгүй
    localStorage.removeItem("fcmToken");
  } catch {
    // Хувийн горимд storage хаалттай байж болно — үүнээс болж зогсох хэрэггүй
  }

  // Router биш window ашиглав: энэ функц React-ийн гаднаас (apiClient) ч
  // дуудагддаг бөгөөд бүрэн дахин ачаалалт нь хуучин төлөвийг цэвэрлэнэ.
  window.location.replace(`/unauthorized?reason=${reason}`);
}
