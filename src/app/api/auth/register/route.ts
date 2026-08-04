import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCaller, serverError, unauthorized } from "@/lib/api/auth";
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
  const caller = await getCaller(request);
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
      await tx
        .insert(appConfig)
        .values({ id: "app", hasAdmin: false })
        .onConflictDoNothing();

      const [config] = await tx
        .select()
        .from(appConfig)
        .where(eq(appConfig.id, "app"))
        .for("update");

      const isFirstAdmin = !config?.hasAdmin;
      const role = isFirstAdmin ? "super" : "user";
      const status = isFirstAdmin ? "active" : "pending";

      const [user] = await tx
        .insert(users)
        .values({
          uid: caller.uid,
          email,
          firstName,
          lastName,
          phone,
          role,
          status,
        })
        .returning();

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
