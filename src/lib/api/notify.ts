import "server-only";

import { inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { fcmTokens, notifications } from "@/lib/db/schema";
import { adminMessaging } from "@/lib/firebaseAdmin";

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
    const tokens = await db
      .select({ token: fcmTokens.token })
      .from(fcmTokens)
      .where(inArray(fcmTokens.uid, targets));

    if (tokens.length === 0) return;

    await adminMessaging().sendEachForMulticast({
      notification: { title: message.title, body: message.body },
      data: {
        title: message.title,
        body: message.body,
        url: message.url ?? "",
      },
      tokens: tokens.map((row) => row.token),
      webpush: {
        notification: { icon: "/icons/icon-192x192.png" },
        fcmOptions: { link: message.url || "/" },
      },
    });
  } catch (error) {
    // Service account дутуу, token хүчингүй гэх мэт — бүртгэл аль хэдийн үлдсэн
    console.warn("Push илгээж чадсангүй:", error);
  }
}
