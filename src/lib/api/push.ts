import "server-only";

import { adminMessaging } from "@/lib/firebaseAdmin";

import type { MulticastMessage } from "firebase-admin/messaging";

/** FCM-ийн нэг multicast дуудалтад багтах token-ы дээд хязгаар */
const FCM_BATCH_SIZE = 500;

/** Token нь дахин хэзээ ч хүчинтэй болохгүй гэдгийг илтгэх алдааны кодууд */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

export type PushNotification = {
  title: string;
  body: string;
  icon?: string;
};

export type PushOutcome = {
  /** FCM хүлээж авсан төхөөрөмжийн тоо */
  sent: number;
  /** Илгээх үед алдаа гарсан тоо */
  failed: number;
  /** Дахин ашиглах боломжгүй болсон token-ууд — дуудагч талаас устгана */
  deadTokens: string[];
  /** Push бүхэлдээ бүтэлгүйтсэн шалтгаан (service account дутуу гэх мэт) */
  error: string | null;
};

/**
 * ЗӨВХӨН `data` талбартай мессеж бүтээнэ — `notification` талбар ОРУУЛАХГҮЙ.
 *
 * ЯАГААД? Firebase-ийн web SDK нь `notification` талбартай push ирэхэд түүнийг
 * ӨӨРӨӨ харуулаад ДАРАА нь `onBackgroundMessage`-ыг дуудна
 * (@firebase/messaging/dist/esm/index.sw.esm.js → onPush). Манай service worker
 * тэр hook дотор `showNotification` дууддаг тул хэрэглэгч мэдэгдэл бүрийг
 * ХОЁР удаа хардаг байв — хоёрын tag нь өөр учир хөтөч ч нийлүүлж чаддаггүй.
 *
 * Data-only мессеж нь SDK-ийн автомат харуулалтыг бүрэн унтраадаг тул харуулах
 * ганц цэг нь service worker болно. Ингэснээр tag, badge, дарах үйлдэл бүгд
 * нэг дор хяналтад үлдэнэ.
 *
 * Бүх token нь web SDK-аас гардаг тул `android`/`apns` тохиргоо энд хэрэггүй.
 * Хожим төрөлх апп нэмбэл тэдгээрийг буцааж оруулах хэрэгтэй болно.
 */
export function buildPushMessage(
  notification: PushNotification,
  data: Record<string, string>,
  tokens: string[]
): MulticastMessage {
  return {
    // Service worker энэ data-г уншиж мэдэгдлийг өөрөө зурна
    data: {
      ...data,
      title: notification.title,
      body: notification.body,
      icon: notification.icon || "/icons/icon-192x192.png",
    },
    tokens,
    webpush: {
      headers: {
        TTL: "86400", // 24 цаг
        Urgency: "high",
      },
    },
  };
}

/**
 * Token-уудад push илгээнэ — 500-гийн багцаар хувааж, үхсэн token-ыг ялгана.
 *
 * Хэзээ ч алдаа шидэхгүй: мэдэгдэл нь `notifications` хүснэгтэд аль хэдийн
 * бичигдсэн байдаг тул push унасан ч үндсэн үйлдлийг унагаах ёсгүй.
 */
export async function sendPush(
  tokens: string[],
  notification: PushNotification,
  data: Record<string, string> = {}
): Promise<PushOutcome> {
  const outcome: PushOutcome = { sent: 0, failed: 0, deadTokens: [], error: null };

  if (tokens.length === 0) return outcome;

  try {
    const messaging = adminMessaging();

    for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
      const chunk = tokens.slice(i, i + FCM_BATCH_SIZE);
      const response = await messaging.sendEachForMulticast(
        buildPushMessage(notification, data, chunk)
      );

      outcome.sent += response.successCount;
      outcome.failed += response.failureCount;

      response.responses.forEach((item, index) => {
        const code = item.error?.code;
        if (code && DEAD_TOKEN_CODES.has(code)) {
          outcome.deadTokens.push(chunk[index]);
        }
      });
    }
  } catch (error) {
    outcome.error =
      error instanceof Error ? error.message : "Push илгээхэд алдаа гарлаа.";
    console.warn("Push илгээж чадсангүй:", error);
  }

  return outcome;
}
