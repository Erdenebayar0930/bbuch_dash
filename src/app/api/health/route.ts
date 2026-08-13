import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getFirebaseAdminConfig, isFirebaseClientConfigured } from "@/lib/config";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  try {
    await db.execute(sql`select 1` as never);
    checks.mysql = "ok";
  } catch (error) {
    checks.mysql = {
      status: "error",
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
