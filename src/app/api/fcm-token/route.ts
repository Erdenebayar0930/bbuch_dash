import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  getCallerOrResponse,
  requireActiveUser,
  serverError,
  unauthorized,
} from "@/lib/api/auth";
import { db } from "@/lib/db";
import { fcmTokens } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Энэ ТӨХӨӨРӨМЖИЙН FCM token-ыг бүртгэнэ.
 *
 * Нэг хэрэглэгч олон мөртэй байж болно — утас дээрх PWA, компьютер дээрх
 * хөтөч тус бүр өөрийн token-той. Урьд нь uid нь түлхүүр байсан тул сүүлд
 * нэвтэрсэн төхөөрөмж бусдынхаа бүртгэлийг дардаг байв.
 */
export async function POST(request: NextRequest) {
  // Хаагдсан хэрэглэгч token бүртгүүлэх ёсгүй — эс бөгөөс түүнд push үргэлжилнэ
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const caller = result.caller;

  try {
    const { token } = await request.json();

    if (typeof token !== "string" || token.length === 0) {
      return badRequest("token шаардлагатай.");
    }

    // Хамтын төхөөрөмж: ижил хөтөч дээр өөр хүн нэвтэрвэл FCM ижил token
    // буцаана. Тэр үед мөрийн эзнийг шинэ хэрэглэгч рүү шилжүүлнэ — эс бөгөөс
    // гарсан хүний мэдэгдэл шинэ хүний дэлгэц дээр гарна.
    await db
      .insert(fcmTokens)
      .values({ token, uid: caller.uid })
      .onDuplicateKeyUpdate({
        set: { uid: caller.uid, updatedAt: new Date() },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "FCM token хадгалахад алдаа гарлаа");
  }
}

/**
 * Token-ыг устгана (гарах, зөвшөөрөл цуцлах үед).
 *
 * `token` дамжуулбал ЗӨВХӨН тэр төхөөрөмжийнхийг устгана. Урьд нь uid-ээр
 * бүгдийг устгадаг байсан тул компьютер дээрээ гармагц утсан дээрх PWA-гийн
 * мэдэгдэл хамт унтардаг байв.
 *
 * `token` алга бол БҮГДИЙГ устгана. Энэ нь санаатай аюулгүй тал руугаа
 * унасан сонголт: клиент өөрийн token-оо олж чадаагүй үед дутуу устгаснаас
 * илүү устгасан нь дээр — гарсан хэрэглэгч рүү push үргэлжлэхээс сэргийлнэ.
 */
export async function DELETE(request: NextRequest) {
  const result = await getCallerOrResponse(request);
  if ("error" in result) return result.error;

  const { caller } = result;
  if (!caller) return unauthorized();

  try {
    // DELETE дээр бие байхгүй байж болно — алдаа шидэлгүй хоосон гэж үзнэ
    const body = (await request.json().catch(() => ({}))) as {
      token?: unknown;
    };
    const token = typeof body.token === "string" ? body.token : "";

    if (token) {
      // uid-ийн шалгалт заавал: өөр хүний төхөөрөмжийн бүртгэлийг token нь
      // мэдэгдмэл байсан ч устгах боломжгүй байх ёстой
      await db
        .delete(fcmTokens)
        .where(and(eq(fcmTokens.token, token), eq(fcmTokens.uid, caller.uid)));
    } else {
      await db.delete(fcmTokens).where(eq(fcmTokens.uid, caller.uid));
    }

    return NextResponse.json({ success: true, scope: token ? "device" : "all" });
  } catch (error) {
    return serverError(error, "FCM token устгахад алдаа гарлаа");
  }
}
