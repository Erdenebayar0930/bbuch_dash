"use client";

import { getToken, onMessage } from "firebase/messaging";

import { messaging } from "./firebase";

export interface NotificationPayload {
  notification?: {
    title?: string;
    body?: string;
    icon?: string;
  };
  data?: {
    url?: string;
    tag?: string;
    [key: string]: string | undefined;
  };
}

/** Хөтөч дээрх сүүлийн token — зөвхөн лавлагаа, эх сурвалж нь Firebase өөрөө */
const TOKEN_CACHE_KEY = "fcmToken";

/**
 * FCM token авна.
 *
 * ⚠ localStorage дахь утгыг ИТГЭЖ БУЦААХГҮЙ. Token хүчингүй болоход сервер
 * түүнийг устгадаг (@see lib/api/push.ts) — гэтэл кэшнээс уншиж дахин бичвэл
 * тухайн хэрэглэгчид push БҮРМӨСӨН зогсоно: илгээх бүрт FCM татгалзаж, мөр
 * устаж, дараагийн нэвтрэлт нь ижил үхсэн token-ыг эргүүлж хадгална.
 *
 * `getToken()` нь өөрөө IndexedDB-д кэштэй бөгөөд шаардлагатай үед л сүлжээ рүү
 * ханддаг тул давтан дуудахад хямд.
 */
export async function getFCMToken(): Promise<string | null> {
  if (typeof window === "undefined" || !messaging) return null;

  if (!("Notification" in window) || Notification.permission !== "granted") {
    return null;
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error("NEXT_PUBLIC_FIREBASE_VAPID_KEY тохируулаагүй байна.");
  }

  const token = await getToken(messaging, { vapidKey });

  try {
    if (token) localStorage.setItem(TOKEN_CACHE_KEY, token);
  } catch {
    // Хувийн горимд storage хаалттай байж болно — token өөрөө хэвийн ажиллана
  }

  return token || null;
}

/**
 * Апп нээлттэй байхад ирсэн мэдэгдлийг сонсоно.
 *
 * Буцаах утга нь цуцлагч — effect-ийн цэвэрлэгээнд ЗААВАЛ дуудна. Өмнө нь энэ
 * функц нэг удаа `resolve` болдог Promise дээр тогтдог байсан тул ЗӨВХӨН анхны
 * мэдэгдлийг барьдаг, цуцлагчгүй учир дахин ажиллах бүрт сонсогч хуримтлуулдаг
 * байв.
 */
export function setupForegroundNotifications(
  callback: (payload: NotificationPayload) => void
): () => void {
  if (typeof window === "undefined" || !messaging) return () => {};

  return onMessage(messaging, (payload) => {
    callback(payload as NotificationPayload);

    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    // Сервер data-only илгээдэг тул утгууд `data` дотор ирнэ
    const data = (payload.data ?? {}) as Record<string, string>;

    new Notification(payload.notification?.title || data.title || "Шинэ мэдэгдэл", {
      body: payload.notification?.body || data.body || "",
      icon: payload.notification?.icon || data.icon || "/icons/icon-192x192.png",
      tag: data.tag || data.id || "notification",
      data,
    });
  });
}
