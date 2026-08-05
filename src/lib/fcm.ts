"use client";

import { deleteToken, getToken } from "firebase/messaging";

import { apiFetch } from "./apiClient";
import { auth, messaging } from "./firebase";
import { getFCMToken } from "./notifications";
import type { UserRole } from "./users";

/**
 * Нэвтэрсэн хэрэглэгчийн FCM token-ыг Postgres-д хадгална.
 * Token нь fcm_tokens хүснэгтэд хэрэглэгч тутамд нэг мөрөөр хадгалагдана.
 */
export async function saveUserFCMToken(token: string) {
  try {
    await apiFetch("/api/fcm-token", { method: "POST", body: { token } });
  } catch (error) {
    console.error("FCM token хадгалахад алдаа гарлаа:", error);
  }
}

/** Өөрийн FCM token-ыг устгана (гарах, зөвшөөрөл цуцлах үед). */
export async function deleteUserFCMToken() {
  try {
    await apiFetch("/api/fcm-token", { method: "DELETE" });
  } catch (error) {
    console.error("FCM token устгахад алдаа гарлаа:", error);
  }
}

// ---------------------------------------------------------------------------
// Зөвшөөрөл идэвхжүүлэх — Тохиргоо → Мэдэгдэл хэсгийн товчноос дуудагдана.
// Хөтчийн зөвшөөрлийн цонх нь хэрэглэгчийн шууд үйлдлээс л найдвартай гарна.
// ---------------------------------------------------------------------------

export type PushSetupResult =
  | { ok: true }
  | { ok: false; reason: string; detail?: string };

/** Хөтөч push мэдэгдэл дэмждэг эсэх */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/** Одоогийн зөвшөөрлийн төлөв */
export function pushPermission(): NotificationPermission | "unsupported" {
  return isPushSupported() ? Notification.permission : "unsupported";
}

/**
 * Зөвшөөрөл гуйж, FCM token авч, серверт хадгална.
 * Алдааг залгихгүй — шалтгааныг нь буцаана, UI дээр харуулна.
 */
export async function enablePushNotifications(): Promise<PushSetupResult> {
  if (!isPushSupported()) {
    return {
      ok: false,
      reason: "Энэ хөтөч push мэдэгдэл дэмжихгүй байна.",
    };
  }

  if (!auth.currentUser) {
    return { ok: false, reason: "Эхлээд системд нэвтэрнэ үү." };
  }

  if (!messaging) {
    return {
      ok: false,
      reason: "Firebase Messaging эхлээгүй байна. Хөтчийн консолыг шалгана уу.",
    };
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    return {
      ok: false,
      reason:
        "VAPID түлхүүр тохируулаагүй байна (NEXT_PUBLIC_FIREBASE_VAPID_KEY).",
    };
  }

  let permission = Notification.permission;

  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission === "denied") {
    return {
      ok: false,
      reason:
        "Мэдэгдэл хаагдсан байна. Хаягийн мөрний түгжээ дүрсээс зөвшөөрөөд дахин оролдоно уу.",
    };
  }

  if (permission !== "granted") {
    return { ok: false, reason: "Зөвшөөрөл олгогдоогүй." };
  }

  try {
    const token = await getToken(messaging, { vapidKey });

    if (!token) {
      return { ok: false, reason: "FCM token авч чадсангүй." };
    }

    localStorage.setItem("fcmToken", token);
    await apiFetch("/api/fcm-token", { method: "POST", body: { token } });

    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    // Хамгийн түгээмэл шалтгаан — VAPID түлхүүр буруу форматтай
    if (detail.includes("applicationServerKey") || detail.includes("P-256")) {
      return {
        ok: false,
        reason:
          "VAPID түлхүүр буруу байна. Firebase Console → Cloud Messaging → Web Push certificates-аас хуулж авна уу.",
        detail,
      };
    }

    return { ok: false, reason: "FCM token авахад алдаа гарлаа.", detail };
  }
}

/** Мэдэгдлийг унтраана — token-ыг хөтөч болон серверээс хоёуланг нь устгана. */
export async function disablePushNotifications(): Promise<void> {
  localStorage.removeItem("fcmToken");

  if (messaging) {
    await deleteToken(messaging).catch((error) => {
      console.warn("FCM token устгахад алдаа гарлаа:", error);
    });
  }

  await deleteUserFCMToken();
}

// ---------------------------------------------------------------------------
// Мэдэгдэл илгээх — /api/notifications/send route дамжуулан (сервер тал).
// FCM өөрөө үнэгүй; service account түлхүүр browser-т гарахгүйн тулд сервер
// талаас илгээнэ. Cloud Functions (Blaze) шаардлагагүй.
// ---------------------------------------------------------------------------

export type SendResult = {
  /** Чиглэлд тохирсон хэрэглэгчийн тоо */
  recipients: number;
  /** Аппын мэдэгдлийн жагсаалтад бичигдсэн тоо — жинхэнэ хүргэлт нь энэ */
  stored: number;
  /** Push амжилттай хүрсэн төхөөрөмжийн тоо */
  sent: number;
  /** Илгээх үед алдаа гарсан тоо */
  failed: number;
  /** FCM token байхгүй тул алгассан тоо */
  withoutToken: number;
  /** Хүчингүй болсон тул устгагдсан token-ы тоо */
  removedTokens: number;
};

/** Хуучин нэр — хойшдын нийцтэй байдлын үүднээс үлдээв */
export type KhorooSendResult = SendResult;

type Target =
  | { type: "all" }
  | { type: "khoroo"; khoroo: number }
  | { type: "aimag"; aimag: string }
  | { type: "role"; role: UserRole }
  | { type: "user"; userId: string };

async function postNotification(
  target: Target,
  title: string,
  body: string,
  data?: { [key: string]: string }
): Promise<SendResult> {
  const result = await apiFetch<Partial<SendResult>>(
    "/api/notifications/send",
    {
      method: "POST",
      body: {
        target,
        notification: { title, body },
        data: data || {},
      },
    }
  );

  return {
    recipients: result.recipients ?? 0,
    stored: result.stored ?? 0,
    sent: result.sent ?? 0,
    failed: result.failed ?? 0,
    withoutToken: result.withoutToken ?? 0,
    removedTokens: result.removedTokens ?? 0,
  };
}

/** Тодорхой нэг хэрэглэгчид мэдэгдэл илгээнэ */
export async function sendNotificationToUser(
  userId: string,
  title: string,
  body: string,
  data?: { [key: string]: string }
): Promise<SendResult> {
  return postNotification({ type: "user", userId }, title, body, data);
}

/** Бүх идэвхтэй хэрэглэгчид мэдэгдэл илгээнэ */
export async function sendNotificationToAllUsers(
  title: string,
  body: string,
  data?: { [key: string]: string }
): Promise<SendResult> {
  return postNotification({ type: "all" }, title, body, data);
}

/**
 * Тодорхой хорооны идэвхтэй хэрэглэгчдэд мэдэгдэл илгээнэ.
 * users/{uid}.khoroo талбарт тулгуурлан хүлээн авагчдыг сонгоно.
 */
export async function sendNotificationToKhoroo(
  khoroo: number,
  title: string,
  body: string,
  data?: { [key: string]: string }
): Promise<SendResult> {
  return postNotification({ type: "khoroo", khoroo }, title, body, data);
}

/**
 * Тодорхой аймгийн идэвхтэй хэрэглэгчдэд мэдэгдэл илгээнэ.
 * users.aimag талбарт тулгуурлан хүлээн авагчдыг сонгоно.
 */
export async function sendNotificationToAimag(
  aimag: string,
  title: string,
  body: string,
  data?: { [key: string]: string }
): Promise<SendResult> {
  return postNotification({ type: "aimag", aimag }, title, body, data);
}

/** Роль дээр тулгуурлан мэдэгдэл илгээнэ. */
export async function sendNotificationToRole(
  role: UserRole,
  title: string,
  body: string,
  data?: { [key: string]: string }
): Promise<SendResult> {
  return postNotification({ type: "role", role }, title, body, data);
}

/** Нэвтэрсэн хэрэглэгчийн FCM token-ыг авч сервер рүү хадгална. */
export async function saveCurrentUserFCMToken() {
  if (typeof window === "undefined") return;

  try {
    const { auth } = await import("./firebase");
    const user = auth.currentUser;

    if (!user) {
      console.warn("Нэвтрээгүй тул FCM token хадгалсангүй");
      return;
    }

    if (Notification.permission !== "granted") {
      console.warn("Мэдэгдлийн зөвшөөрөл олгоогүй тул FCM token авсангүй");
      return;
    }

    const token = await getFCMToken();
    if (token) {
      await saveUserFCMToken(token);
    } else {
      console.warn("FCM token авч чадсангүй:", user.uid);
    }
  } catch (error) {
    console.error("FCM token хадгалахад алдаа гарлаа:", error);
  }
}
