import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getFirebaseAdminConfig, isFirebaseClientConfigured } from "@/lib/config";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * mysql2-ийн алдааны кодыг хүн ойлгохоор тайлбар руу буулгана.
 *
 * Эдгээр нь бодит байршуулалтад хамгийн олон тааралддаг гурав-дөрөв:
 * буруу нууц үг, байхгүй сан, хаалттай порт.
 */
const MYSQL_HINTS: Record<string, string> = {
  ER_ACCESS_DENIED_ERROR:
    "Хэрэглэгчийн нэр эсвэл нууц үг буруу. Hosting дээрх хэрэглэгч ихэвчлэн дансны угтвартай байдгийг анхаарна уу.",
  ER_DBACCESS_DENIED_ERROR: "Хэрэглэгчид энэ санд хандах эрх олгоогүй байна.",
  ER_BAD_DB_ERROR: "Заасан нэртэй сан байхгүй байна.",
  ER_NO_SUCH_TABLE: "Хүснэгт байхгүй — `npm run db:push` ажиллуулаагүй байж магадгүй.",
  ECONNREFUSED: "MySQL сервер хариу өгсөнгүй — host болон порт-оо шалгана уу.",
  ENOTFOUND: "MySQL-ийн хостын нэр олдсонгүй.",
  ETIMEDOUT: "MySQL холболт хугацаа хэтэрлээ.",
  PROTOCOL_CONNECTION_LOST: "MySQL холболт тасарлаа.",
};

/**
 * Драйверийн жинхэнэ алдааны кодыг олно.
 *
 * Drizzle нь mysql2-ийн алдааг өөрийн "Failed query: …" алдаагаар БООДОГ тул
 * дээд түвшний мессеж нь юу болсныг огт хэлдэггүй. Жинхэнэ шалтгаан нь
 * `cause` гинжин дотор нуугдана — түүнийг гүйлгэж олно.
 */
function findDriverCode(error: unknown): string | null {
  let current: unknown = error;

  for (let depth = 0; current && depth < 5; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }

  return null;
}

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  try {
    await db.execute(sql`select 1` as never);
    checks.mysql = "ok";
  } catch (error) {
    const code = findDriverCode(error);

    checks.mysql = {
      status: "error",
      /**
       * ЗӨВХӨН кодыг гаргана — драйверийн бүтэн мессеж нь хэрэглэгчийн нэр,
       * хостыг агуулдаг (жишээ нь "Access denied for user 'x'@'::1'"), харин
       * энэ endpoint нээлттэй тул тэднийг ил гаргах ёсгүй. Код нь юу болсныг
       * оношлоход хангалттай.
       */
      code: code ?? "UNKNOWN",
      hint: code ? (MYSQL_HINTS[code] ?? null) : null,
      // Drizzle-ийн өөрийн мессеж — асуулгыг л агуулна, нууц зүйл байхгүй
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }

  const firebaseConfig = getFirebaseAdminConfig();
  checks.firebase = {
    status: firebaseConfig.projectId && firebaseConfig.clientEmail && firebaseConfig.privateKey ? "configured" : "missing-config",
    projectId: firebaseConfig.projectId || null,
  };

  /**
   * Client тохиргоо нь build ҮЕД кодод шигддэг тул энд харагдах утга нь
   * "сүүлийн build хийх үед NEXT_PUBLIC_* байсан уу" гэдгийг илэрхийлнэ.
   * `fallback` бол env нэмсний дараа заавал ДАХИН DEPLOY хийх шаардлагатай —
   * зөвхөн restart хийхэд шинэ утга кодод орохгүй.
   */
  checks.firebaseClient = isFirebaseClientConfigured()
    ? "configured"
    : "fallback";

  return NextResponse.json(checks);
}
