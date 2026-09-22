import "server-only";

import { and, eq, inArray, or, sql } from "drizzle-orm";

import { sendPush } from "@/lib/api/push";
import { db } from "@/lib/db";
import { fcmTokens, notifications, users } from "@/lib/db/schema";

export type NotifyTarget =
  | { type: "all" }
  | { type: "aimag"; aimags: string[] }
  | { type: "role"; role: string }
  | { type: "user"; userId: string };

/** Чиглэлээс хамаарч хүлээн авагчдын uid-г олно. */
export async function resolveNotifyTargets(target: NotifyTarget): Promise<string[]> {
  if (target.type === "user") {
    const rows = await db
      .select({ uid: users.uid })
      .from(users)
      .where(eq(users.uid, target.userId))
      .limit(1);

    return rows.map((row) => row.uid);
  }

  const where =
    target.type === "aimag"
      ? // Postgres-ийн jsonb containment хайлт: `баримт @> утга`.
        // Сонгосон аймгуудын АЛЬ НЭГЭНД нь харьяалагдвал хангалттай (OR).
        and(
          eq(users.status, "active"),
          or(
            ...target.aimags.map(
              (aimag) => sql`${users.aimags} @> ${JSON.stringify([aimag])}::jsonb`
            )
          )
        )
      : target.type === "role"
        ? and(eq(users.status, "active"), eq(users.role, target.role))
        : eq(users.status, "active");

  const rows = await db.select({ uid: users.uid }).from(users).where(where);
  return rows.map((row) => row.uid);
}

type Message = {
  title: string;
  body: string;
  /** Дарахад шилжих зам — хоосон бол шилжихгүй */
  url?: string;
};

/**
 * Заасан хэрэглэгчдэд мэдэгдэл бичээд боломжтой бол push илгээнэ.
 *
 * Жинхэнэ бүртгэл нь `notifications` хүснэгт — push нь зөвхөн мэдэгдүүлэг тул
 * түүний алдаа үндсэн үйлдлийг (даалгавар үүсгэх зэрэг) унагаах ёсгүй.
 * Тиймээс энэ функц хэзээ ч алдаа шиднэ гэж бодох шаардлагагүй.
 */
export async function notifyUsers(
  uids: string[],
  message: Message,
  createdBy?: string
): Promise<void> {
  const targets = [...new Set(uids.filter(Boolean))];
  if (targets.length === 0) return;

  try {
    await db.insert(notifications).values(
      targets.map((uid) => ({
        uid,
        title: message.title,
        body: message.body,
        url: message.url ?? "",
        createdBy: createdBy ?? null,
      }))
    );
  } catch (error) {
    console.warn("Мэдэгдэл бичихэд алдаа гарлаа:", error);
    return;
  }

  try {
    const rows = await db
      .select({ token: fcmTokens.token })
      .from(fcmTokens)
      .where(inArray(fcmTokens.uid, targets));

    if (rows.length === 0) return;

    // sendPush нь 500-гийн багцаар хуваах, үхсэн token ялгах ажлыг хийнэ —
    // өмнө нь энэ зам тэр хоёрын аль нь ч байхгүй байв.
    const outcome = await sendPush(
      rows.map((row) => row.token),
      { title: message.title, body: message.body },
      { url: message.url ?? "" }
    );

    if (outcome.deadTokens.length > 0) {
      await db
        .delete(fcmTokens)
        .where(inArray(fcmTokens.token, outcome.deadTokens));
    }
  } catch (error) {
    // Service account дутуу, token хүчингүй гэх мэт — бүртгэл аль хэдийн үлдсэн
    console.warn("Push илгээж чадсангүй:", error);
  }
}
