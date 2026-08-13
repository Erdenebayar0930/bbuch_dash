import "server-only";

import { inArray } from "drizzle-orm";

import { sendPush } from "@/lib/api/push";
import { db } from "@/lib/db";
import { fcmTokens, notifications } from "@/lib/db/schema";

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
