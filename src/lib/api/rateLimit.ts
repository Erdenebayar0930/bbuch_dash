import "server-only";

import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

/**
 * Санах ойн энгийн хурдны хязгаарлагч.
 *
 * Firebase Auth нь нэвтрэх оролдлогыг өөрөө хязгаарладаг ч, ТОКЕНТОЙ болсны
 * дараах үйлдлүүд бүрэн хязгааргүй байв. Хамгийн үнэтэй нь:
 *   • /api/export/*        — бүх хүснэгтийг санах ойд Excel болгож барина
 *   • /api/statement/*     — банкны хуулга задлан шинжилнэ
 *   • /api/notifications/send — олон зуун төхөөрөмж рүү push илгээнэ
 *   • /api/auth/register   — бүртгэлийн мөр үүсгэнэ
 * Эдгээрийг давталтаар дуудахад нэг хэрэглэгч серверийг унагаах, эсвэл бүх
 * гишүүн рүү спам мэдэгдэл цацах боломжтой байсан.
 *
 * ⚠ Хязгаар нь ПРОЦЕСС бүрд тусдаа. Одоогийн байршуулалт (Passenger, нэг урт
 * амьдралтай процесс) дээр энэ нь зөв ажиллана. Хэрэв ирээдүйд олон instance
 * ажиллуулбал энэ хязгаар instance-ийн тоогоор үржинэ — тэр үед Redis зэрэг
 * гадаад санах ой руу шилжүүлэх шаардлагатай.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Хаягдсан мөрийг цэвэрлэнэ.
 *
 * Түлхүүр нь IP/uid-аар үүсдэг тул цэвэрлэхгүй бол Map нь хязгааргүй ургаж,
 * удаан ажиллах процесст санах ойн алдагдал болно.
 */
function sweep(now: number) {
  if (buckets.size < 5_000) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Дуудагчийг таних түлхүүр.
 *
 * Нэвтэрсэн бол ID token-ы сүүлийн хэсгээр — ижил IP-гийн ард сууж буй хоёр
 * хэрэглэгч бие биеэ хаахгүйн тулд. Токен бүрэн задлах шаардлагагүй: нэг
 * хэрэглэгчийн токен нэг цагийн турш тогтмол байдаг тул түүний хэсэг нь
 * тогтвортой таних тэмдэг болно.
 *
 * ⚠ Прокси/CDN-ий ард x-forwarded-for-ыг хэрэглэгч хуурамчаар илгээж чадна.
 * Тиймээс энэ нь урвуулан ашиглалтыг УДААШРУУЛАХ хэрэгсэл болохоос эрхийн
 * шалгалтыг ОРЛОХГҮЙ — жинхэнэ хамгаалалт нь require* функцүүд.
 */
function callerKey(request: NextRequest): string {
  const token = request.headers.get("authorization");
  if (token?.startsWith("Bearer ")) return `t:${token.slice(-32)}`;

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}

export type RateLimitOptions = {
  /** Цонхонд зөвшөөрөх хүсэлтийн тоо */
  limit: number;
  /** Цонхны урт (мс) */
  windowMs: number;
  /** Өөр route-ууд нэг хувингаас идэхээс сэргийлнэ */
  name: string;
};

/**
 * Хязгаар хэтэрсэн бол 429 хариу, эс бөгөөс `null` буцаана.
 *
 * Хэрэглэх загвар — эрхийн шалгалтын ДАРАА тавина. Ингэснээр нэвтрээгүй
 * хүсэлт хувинг дүүргэж, жинхэнэ хэрэглэгчийг хаах боломжгүй болно:
 *
 *   const result = await requireAdmin(request);
 *   if ("error" in result) return result.error;
 *   const limited = rateLimit(request, { name: "send", limit: 10, windowMs: 60_000 });
 *   if (limited) return limited;
 */
export function rateLimit(
  request: NextRequest,
  { limit, windowMs, name }: RateLimitOptions
): NextResponse | null {
  const now = Date.now();
  sweep(now);

  const key = `${name}:${callerKey(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  bucket.count += 1;

  if (bucket.count <= limit) return null;

  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);

  return NextResponse.json(
    {
      error: `Хэт олон хүсэлт илгээлээ. ${retryAfter} секундын дараа дахин оролдоно уу.`,
      code: "rate-limited",
    },
    {
      status: 429,
      // Клиент хэзээ дахин оролдохыг таамаглахгүйн тулд стандарт толгойгоор
      headers: { "Retry-After": String(retryAfter) },
    }
  );
}
