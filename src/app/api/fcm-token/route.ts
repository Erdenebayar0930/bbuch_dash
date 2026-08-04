import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  getCaller,
  requireActiveUser,
  serverError,
  unauthorized,
} from "@/lib/api/auth";
import { db } from "@/lib/db";
import { fcmTokens } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Өөрийн FCM token-ыг хадгална (нэг хэрэглэгчид нэг token). */
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

    await db
      .insert(fcmTokens)
      .values({ uid: caller.uid, token })
      .onConflictDoUpdate({
        target: fcmTokens.uid,
        set: { token, updatedAt: new Date() },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "FCM token хадгалахад алдаа гарлаа");
  }
}

/** Өөрийн token-ыг устгана (гарах, зөвшөөрөл цуцлах үед). */
export async function DELETE(request: NextRequest) {
  const caller = await getCaller(request);
  if (!caller) return unauthorized();

  try {
    await db.delete(fcmTokens).where(eq(fcmTokens.uid, caller.uid));
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "FCM token устгахад алдаа гарлаа");
  }
}
