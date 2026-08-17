"use client";

import { deleteToken } from "firebase/messaging";

import { apiFetch } from "./apiClient";
import { auth, messaging } from "./firebase";
import { getFCMToken } from "./notifications";

/**
 * Нэвтэрсэн хэрэглэгчийн FCM token-ыг серверт хадгална.
 *
 * `fcm_tokens` нь ТӨХӨӨРӨМЖ тутамд нэг мөртэй: утсан дээрх PWA, компьютер
 * дээрх хөтөч тус тусдаа бүртгэгдэнэ.
 */
export async function saveUserFCMToken(token: string) {
  try {
    await apiFetch("/api/fcm-token", { method: "POST", body: { token } });
  } catch (error) {
    console.error("FCM token хадгалахад алдаа гарлаа:", error);
  }
}

/**
 * Энэ ТӨХӨӨРӨМЖИЙН FCM token-ыг серверээс устгана.
 *
 * Кэшлэсэн token-оо дамжуулна — эс бөгөөс сервер хэрэглэгчийн БҮХ
 * төхөөрөмжийг устгах тул компьютер дээрээ гармагц утсан дээрх PWA-гийн
 * мэдэгдэл хамт унтарна.
 *
 * Кэш олдохгүй бол token-гүй илгээнэ: сервер тэр үед бүгдийг устгана. Энэ нь
 * зориудаар аюулгүй тал руугаа унасан сонголт — гарсан хэрэглэгч рүү push
 * үргэлжлэхээс сэргийлэх нь бусад төхөөрөмжийг дахин бүртгүүлэхээс чухал.
 */
export async function deleteUserFCMToken() {
  let token = "";

  try {
    token = localStorage.getItem("fcmToken") ?? "";
  } catch {
    // Хувийн горимд storage хаалттай байж болно — бүгдийг устгах горимд орно
  }

  try {
    await apiFetch("/api/fcm-token", {
      method: "DELETE",
      body: token ? { token } : {},
    });
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
    // Token авах ганц цэг нь getFCMToken — vapid түлхүүр, кэш хоёулаа тэнд
    const token = await getFCMToken();

    if (!token) {
      return { ok: false, reason: "FCM token авч чадсангүй." };
    }

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

/**
 * Мэдэгдлийг ЭНЭ ТӨХӨӨРӨМЖ дээр унтраана.
 *
 * ⚠ Дараалал чухал: серверээс устгах нь localStorage цэвэрлэхээс ӨМНӨ байх
 * ёстой. `deleteUserFCMToken` нь кэшлэсэн token-оор аль төхөөрөмж болохыг
 * заадаг — өмнө нь кэшийг эхэлж арчдаг байсан тул сервер "аль нь ч мэдэгдээгүй"
 * гэж үзээд хэрэглэгчийн БҮХ төхөөрөмжийг устгадаг байв. Утсан дээрээ
 * мэдэгдлээ унтраахад компьютер дээрх нь ч хамт унтарна гэсэн үг.
 */
export async function disablePushNotifications(): Promise<void> {
  await deleteUserFCMToken();

  if (messaging) {
    await deleteToken(messaging).catch((error) => {
      console.warn("FCM token устгахад алдаа гарлаа:", error);
    });
  }

  try {
    localStorage.removeItem("fcmToken");
  } catch {
    // Хувийн горимд storage хаалттай байж болно
  }
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

/**
 * Сервер талын /api/notifications/send нь `aimag`, `role` чиглэлийг мөн
 * дэмждэг — гэвч UI-аас тэдгээрийг хассан тул энд зөвхөн ашиглагдаж буй
 * хоёрыг үлдээв.
 */
type Target = { type: "all" } | { type: "user"; userId: string };

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
 * Нэвтэрсэн хэрэглэгчийн FCM token-ыг авч сервер рүү хадгална.
 *
 * Хамаарлын чиглэл нэг талдаа: fcm.ts → notifications.ts. Урьд нь
 * `getFCMToken()` эргээд энэ функцийг дууддаг байсан тул token нэг авахад
 * сервер рүү ХОЁР удаа бичдэг, localStorage бичигдэхгүй орчинд хязгааргүй
 * рекурс болох эрсдэлтэй байв — тэр гогцоог сэргээж болохгүй.
 */
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
