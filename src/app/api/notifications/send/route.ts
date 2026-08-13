import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { aimags, isValidOption } from "@/data/profileOptions";
import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { sendPush } from "@/lib/api/push";
import { db } from "@/lib/db";
import { fcmTokens, notifications, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

// firebase-admin нь Node.js runtime шаардана (Edge дээр ажиллахгүй)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Target =
  | { type: "all" }
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
    target.type === "aimag"
      ? // Нэг хүн олон аймагт харьяалагдаж болох тул containment хайлт.
        // Postgres дээр `aimags @> '["x"]'::jsonb` байсан — MySQL-ийн
        // дүйцэх функц нь JSON_CONTAINS(баримт, хайх_утга).
        and(
          eq(users.status, "active"),
          sql`json_contains(${users.aimags}, ${JSON.stringify(target.aimag)})`
        )
      : target.type === "role"
      ? and(eq(users.status, "active"), eq(users.role, target.role))
      : eq(users.status, "active");

  const rows = await db.select({ uid: users.uid }).from(users).where(where);
  return rows.map((row) => row.uid);
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
    // MySQL нь INSERT ... RETURNING дэмждэггүй. Энд зөвхөн БИЧИГДСЭН МӨРИЙН ТОО
    // хэрэгтэй тул үр дүнгийн `affectedRows`-ыг авна.
    const [stored] = await db.insert(notifications).values(
      uids.map((uid) => ({
        id: crypto.randomUUID(),
        uid,
        title: notification.title as string,
        body: notification.body as string,
        url: typeof data?.url === "string" ? data.url : "",
        createdBy: auth.caller.uid,
      }))
    );

    result.stored = stored.affectedRows;

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
      payloadData.aimag = target.aimag;
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
