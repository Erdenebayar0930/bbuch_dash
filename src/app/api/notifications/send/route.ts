import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { aimags, isValidOption } from "@/data/profileOptions";
import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { fcmTokens, notifications, users } from "@/lib/db/schema";
import { adminMessaging } from "@/lib/firebaseAdmin";

import type { MulticastMessage } from "firebase-admin/messaging";
import type { NextRequest } from "next/server";

// firebase-admin нь Node.js runtime шаардана (Edge дээр ажиллахгүй)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** FCM-ийн нэг multicast дуудалтад багтах token-ы дээд хязгаар */
const FCM_BATCH_SIZE = 500;

type Target =
  | { type: "all" }
  | { type: "khoroo"; khoroo: number }
  | { type: "aimag"; aimag: string }
  | { type: "role"; role: string }
  | { type: "user"; userId: string };

/** Чиглэлээс хамаарч хүлээн авагчдын uid-г олно */
async function resolveRecipients(target: Target): Promise<string[]> {
  if (target.type === "user") {
    // Байхгүй uid руу мэдэгдэл бичвэл FK алдаа өгнө — эхлээд шалгана
    const rows = await db
      .select({ uid: users.uid })
      .from(users)
      .where(eq(users.uid, target.userId))
      .limit(1);

    return rows.map((row) => row.uid);
  }

  const where =
    target.type === "khoroo"
      ? and(eq(users.status, "active"), eq(users.khoroo, target.khoroo))
      : target.type === "aimag"
      ? // Нэг хүн олон аймагт харьяалагдаж болох тул containment хайлт
        and(
          eq(users.status, "active"),
          sql`${users.aimags} @> ${JSON.stringify([target.aimag])}::jsonb`
        )
      : target.type === "role"
      ? and(eq(users.status, "active"), eq(users.role, target.role))
      : eq(users.status, "active");

  const rows = await db.select({ uid: users.uid }).from(users).where(where);
  return rows.map((row) => row.uid);
}

/** Web / Android / iOS сувгуудад тохирсон мессеж бэлтгэнэ */
function buildMessage(
  notification: { title: string; body: string; icon?: string },
  data: Record<string, string>,
  tokens: string[]
): MulticastMessage {
  return {
    notification: {
      title: notification.title,
      body: notification.body,
    },
    // App хаалттай үед service worker энэ data-г уншина
    data: {
      ...data,
      title: notification.title,
      body: notification.body,
      id: data.id || `notification-${Date.now()}`,
      timestamp: Date.now().toString(),
    },
    tokens,
    webpush: {
      notification: {
        title: notification.title,
        body: notification.body,
        icon: notification.icon || "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200],
      },
      fcmOptions: { link: data.url || "/" },
      headers: { TTL: "86400" }, // 24 цаг
    },
    android: {
      priority: "high",
      notification: { sound: "default", channelId: "default" },
    },
    apns: {
      payload: { aps: { sound: "default", badge: 1 } },
    },
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { target, notification, data } = body as {
      target: Target;
      notification: { title?: string; body?: string; icon?: string };
      data?: Record<string, string>;
    };

    if (!notification?.title || !notification?.body) {
      return badRequest("notification.title болон notification.body шаардлагатай.");
    }

    if (
      !target ||
      (target.type === "khoroo" && typeof target.khoroo !== "number") ||
      (target.type === "role" && !target.role) ||
      (target.type === "user" && !target.userId)
    ) {
      return badRequest("Хүлээн авагчийн чиглэл (target) буруу байна.");
    }

    // Аймаг нь тогтсон жагсаалттай — байхгүй нэр рүү илгээхийг зөвшөөрөхгүй
    if (
      target.type === "aimag" &&
      (!target.aimag || !isValidOption(aimags, target.aimag))
    ) {
      return badRequest("Аймаг буруу байна.");
    }

    const uids = await resolveRecipients(target);

    const result = {
      recipients: uids.length,
      /** Аппын мэдэгдлийн жагсаалтад бичигдсэн тоо */
      stored: 0,
      sent: 0,
      failed: 0,
      withoutToken: 0,
      removedTokens: 0,
    };

    if (uids.length === 0) {
      return NextResponse.json({ success: true, ...result });
    }

    // Эхлээд DB-д бичнэ. Push нь зөвхөн мэдэгдүүлэг тул түүнгүйгээр ч
    // хэрэглэгч дараагийн удаа ороход уншаагүй мэдэгдлээ харна.
    const stored = await db
      .insert(notifications)
      .values(
        uids.map((uid) => ({
          uid,
          title: notification.title as string,
          body: notification.body as string,
          url: typeof data?.url === "string" ? data.url : "",
          createdBy: auth.caller.uid,
        }))
      )
      .returning({ id: notifications.id });

    result.stored = stored.length;

    const tokenRows = await db
      .select({ uid: fcmTokens.uid, token: fcmTokens.token })
      .from(fcmTokens)
      .where(inArray(fcmTokens.uid, uids));

    result.withoutToken = uids.length - tokenRows.length;

    if (tokenRows.length === 0) {
      return NextResponse.json({ success: true, ...result });
    }

    const payloadData: Record<string, string> = { ...(data ?? {}) };
    if (target.type === "khoroo") {
      payloadData.khoroo = String(target.khoroo);
    }
    if (target.type === "aimag") {
      payloadData.aimag = target.aimag;
    }

    const staleUids: string[] = [];
    /** Push бүтэлгүйтвэл шалтгааныг буцаана — мэдэгдэл өөрөө аль хэдийн хадгалагдсан */
    let pushError: string | null = null;

    try {
      const messaging = adminMessaging();

      for (let i = 0; i < tokenRows.length; i += FCM_BATCH_SIZE) {
        const chunk = tokenRows.slice(i, i + FCM_BATCH_SIZE);
        const response = await messaging.sendEachForMulticast(
          buildMessage(
            notification as { title: string; body: string; icon?: string },
            payloadData,
            chunk.map((row) => row.token)
          )
        );

        result.sent += response.successCount;
        result.failed += response.failureCount;

        response.responses.forEach((item, index) => {
          const code = item.error?.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token" ||
            code === "messaging/invalid-argument"
          ) {
            staleUids.push(chunk[index].uid);
          }
        });
      }
    } catch (error) {
      // Service account дутуу зэрэг тохиолдол — мэдэгдэл DB-д үлдсэн тул
      // үйлдлийг бүхэлд нь амжилтгүй гэж үзэхгүй
      pushError =
        error instanceof Error ? error.message : "Push илгээхэд алдаа гарлаа.";
      console.warn("Push илгээж чадсангүй:", error);
    }

    // Хүчингүй болсон token-ыг цэвэрлэнэ
    if (staleUids.length > 0) {
      await db
        .delete(fcmTokens)
        .where(inArray(fcmTokens.uid, staleUids))
        .catch((error) =>
          console.warn("Token цэвэрлэхэд алдаа гарлаа:", error)
        );
      result.removedTokens = staleUids.length;
    }

    console.log("Мэдэгдэл илгээв:", { target, ...result, by: auth.caller.uid });

    return NextResponse.json({ success: true, ...result, pushError });
  } catch (error) {
    return serverError(error, "Мэдэгдэл илгээхэд алдаа гарлаа");
  }
}
