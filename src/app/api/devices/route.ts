import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireActiveUser, serverError } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { devices } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * userAgent-ээс хувилбарын дугаарыг арилгаж, browser+OS-ийн "гарын үсэг" гаргана.
 *
 * localStorage дахь deviceId нь browser шинэчлэгдэх, кэш цэвэрлэгдэх зэрэгт
 * дахин үүсдэг тул ЯГ ЛОГТОЙ (browser+OS адилхан) төхөөрөмж хэдэн ч удаа
 * дахин бүртгэгдэж болно. Ижил гарын үсэгтэй мөрүүдээс хамгийн сүүлд
 * харагдсаныг л харуулж, хуучин "давхардлыг" нуухад ашиглана.
 */
function deviceSignature(userAgent: string): string {
  return userAgent.replace(/[\d.]+/g, "");
}

/**
 * Өөрийн нэвтэрсэн төхөөрөмжүүдийг жагсаана.
 *
 * Ижил browser+OS-тэй (зөвхөн хувилбарын дугаараар ялгаатай) мөрүүдийг нэг
 * төхөөрөмж гэж үзэж, хамгийн сүүлд идэвхтэй байсныг нь л буцаана — өгөгдөл
 * устгахгүй, зөвхөн харуулахдаа хасна.
 */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select()
      .from(devices)
      .where(eq(devices.uid, result.caller.uid))
      .orderBy(desc(devices.lastSeenAt));

    const seen = new Set<string>();
    const deduped = rows.filter((row) => {
      const signature = deviceSignature(row.userAgent);
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });

    return NextResponse.json({ devices: deduped });
  } catch (error) {
    return serverError(error, "Төхөөрөмжүүдийг татахад алдаа гарлаа.");
  }
}
