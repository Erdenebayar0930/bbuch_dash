import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { aimags, isValidOption } from "@/data/profileOptions";
import { badRequest, forbidden, requireNotifier, serverError } from "@/lib/api/auth";
import { resolveNotifyTargets, type NotifyTarget } from "@/lib/api/notify";
import { sendPush } from "@/lib/api/push";
import { rateLimit } from "@/lib/api/rateLimit";
import { db } from "@/lib/db";
import { fcmTokens, notifications } from "@/lib/db/schema";
import { isAdminRole } from "@/lib/permissions";

import type { NextRequest } from "next/server";

// firebase-admin нь Node.js runtime шаардана (Edge дээр ажиллахгүй)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Target = NotifyTarget;

export async function POST(request: NextRequest) {
  const auth = await requireNotifier(request);
  if ("error" in auth) return auth.error;

  // Хамгийн их урвуулан ашиглагдах чадвартай үйлдэл: нэг дуудалт бүх гишүүний
  // утас руу мэдэгдэл цацна. Эвдэрсэн админ данс эсвэл хулгайлагдсан токен
  // энэ route-оор л хамгийн их хор хийнэ.
  const limited = rateLimit(request, {
    name: "notify-send",
    // Хязгаар нь ПРОЦЕСС бүрд тусдаа тул Passenger олон процесс асаахад
    // бодит хязгаар үржинэ — тоог тэр нөөцтэйгээр сонгов.
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

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
      (target.type === "role" && !target.role) ||
      (target.type === "user" && !target.userId) ||
      (target.type === "aimag" && (!Array.isArray(target.aimags) || target.aimags.length === 0))
    ) {
      return badRequest("Хүлээн авагчийн чиглэл (target) буруу байна.");
    }

    // Админ бус (зөвхөн canNotify эрхтэй) хэрэглэгч бүх хэрэглэгч рүү эсвэл
    // эрхийн бүлгээр (role) илгээж чадахгүй — зөвхөн тодорхой аймаг/хүн рүү.
    if (!isAdminRole(auth.caller.user?.role) && target.type !== "aimag" && target.type !== "user") {
      return forbidden("Зөвхөн тодорхой аймаг эсвэл хүн рүү мэдэгдэл илгээх боломжтой.");
    }

    // Аймаг нь тогтсон жагсаалттай — байхгүй нэр рүү илгээхийг зөвшөөрөхгүй
    if (
      target.type === "aimag" &&
      !target.aimags.every((value) => isValidOption(aimags, value))
    ) {
      return badRequest("Аймаг буруу байна.");
    }

    const uids = await resolveNotifyTargets(target);

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
          id: crypto.randomUUID(),
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

    // Нэг хэрэглэгч олон төхөөрөмжтэй байж болох тул мөрийн тоо биш, ЯЛГААТАЙ
    // uid-ийн тоогоор хасна
    result.withoutToken = uids.length - new Set(tokenRows.map((row) => row.uid)).size;

    if (tokenRows.length === 0) {
      return NextResponse.json({ success: true, ...result });
    }

    const payloadData: Record<string, string> = { ...(data ?? {}) };
    if (target.type === "aimag") {
      payloadData.aimags = target.aimags.join(",");
    }

    const outcome = await sendPush(
      tokenRows.map((row) => row.token),
      notification as { title: string; body: string; icon?: string },
      payloadData
    );

    result.sent = outcome.sent;
    result.failed = outcome.failed;

    // Хүчингүй болсон token-ыг цэвэрлэнэ. uid-ээр БИШ, яг тэр token-оор устгана —
    // эс бөгөөс нэг төхөөрөмж унтарахад хэрэглэгчийн бусад төхөөрөмж хамт хасагдана.
    if (outcome.deadTokens.length > 0) {
      await db
        .delete(fcmTokens)
        .where(inArray(fcmTokens.token, outcome.deadTokens))
        .catch((error) =>
          console.warn("Token цэвэрлэхэд алдаа гарлаа:", error)
        );
      result.removedTokens = outcome.deadTokens.length;
    }

    console.log("Мэдэгдэл илгээв:", { target, ...result, by: auth.caller.uid });

    // Push унасан ч мэдэгдэл DB-д үлдсэн тул үйлдлийг амжилтгүй гэж үзэхгүй —
    // шалтгааныг нь админд харуулахаар буцаана
    return NextResponse.json({ success: true, ...result, pushError: outcome.error });
  } catch (error) {
    return serverError(error, "Мэдэгдэл илгээхэд алдаа гарлаа");
  }
}
