import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCallerOrResponse, serverError, unauthorized } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rateLimit";
import { db } from "@/lib/db";
import { appConfig, registrations, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Firebase Auth дээр бүртгэл үүссэний дараа Postgres дэх мөрийг үүсгэнэ.
 *
 * Системийн анхны хэрэглэгч → super / active (систем эзэнгүй үлдэхгүйн тулд).
 * Дараагийнх → user / pending, админ зөвшөөрөх хүртэл нэвтэрч чадахгүй.
 *
 * "Анхны админ"-ыг зөвхөн нэг удаа олгохын тулд app_config мөрийг
 * мөр түгжээтэйгээр (FOR UPDATE) уншиж, нэг гүйлгээнд шийднэ.
 */
export async function POST(request: NextRequest) {
  // Энэ бол бүртгэлгүй хүн хүрч чадах ЦОРЫН ГАНЦ бичих route. Firebase дээр
  // дурын хэрэглэгч данс үүсгэж чадвал энд `users`/`registrations` хүснэгтийг
  // дүүргэх боломжтой болно — админы жагсаалт хогоор дүүрэхээс сэргийлнэ.
  const limited = rateLimit(request, {
    name: "register",
    limit: 5,
    windowMs: 300_000,
  });
  if (limited) return limited;

  // Сан унасныг "нэвтрээгүй" гэж андуурч болохгүй — 503 буцаана
  const result = await getCallerOrResponse(request);
  if ("error" in result) return result.error;

  const { caller } = result;
  if (!caller) return unauthorized();

  // Аль хэдийн бүртгэлтэй бол давхардуулахгүй
  if (caller.user) {
    return NextResponse.json({ user: caller.user, created: false });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const email = (caller.email || String(body.email ?? "")).trim().toLowerCase();

    const created = await db.transaction(async (tx) => {
      // Тохиргооны мөр байхгүй бол үүсгэнэ
      // MySQL-ийн "мөр байхгүй бол үүсгэ" — Postgres-ийн onConflictDoNothing
      // нь энд `onDuplicateKeyUpdate`-аар илэрхийлэгдэнэ. `id`-г өөр дээр нь
      // онооно: жинхэнэ өөрчлөлт хийхгүй, зөвхөн алдааг залгина.
      await tx
        .insert(appConfig)
        .values({ id: "app", hasAdmin: false })
        .onDuplicateKeyUpdate({ set: { id: "app" } });

      const [config] = await tx
        .select()
        .from(appConfig)
        .where(eq(appConfig.id, "app"))
        .for("update");

      const isFirstAdmin = !config?.hasAdmin;
      const role = isFirstAdmin ? "super" : "user";
      const status = isFirstAdmin ? "active" : "pending";

      // MySQL нь INSERT ... RETURNING дэмждэггүй. `uid` нь Firebase-ээс
      // ирсэн үндсэн түлхүүр тул мөрөө шууд буцааж уншиж болно.
      await tx.insert(users).values({
        uid: caller.uid,
        email,
        firstName,
        lastName,
        phone,
        role,
        status,
      });

      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.uid, caller.uid))
        .limit(1);

      await tx.insert(registrations).values({
        uid: caller.uid,
        email,
        firstName,
        lastName,
        phone,
        role,
        status,
      });

      if (isFirstAdmin) {
        await tx
          .update(appConfig)
          .set({ hasAdmin: true })
          .where(eq(appConfig.id, "app"));
      }

      return { user, isFirstAdmin };
    });

    return NextResponse.json({
      user: created.user,
      isFirstAdmin: created.isFirstAdmin,
      created: true,
    });
  } catch (error) {
    return serverError(error, "Бүртгэл үүсгэхэд алдаа гарлаа");
  }
}

/** Системд админ бүртгэгдсэн эсэх — бүртгэлийн формд харуулахад. */
export async function GET() {
  try {
    const [config] = await db
      .select({ hasAdmin: appConfig.hasAdmin })
      .from(appConfig)
      .where(eq(appConfig.id, "app"))
      .limit(1);

    return NextResponse.json({ hasAdmin: config?.hasAdmin ?? false });
  } catch (error) {
    return serverError(error, "Тохиргоог уншихад алдаа гарлаа");
  }
}
