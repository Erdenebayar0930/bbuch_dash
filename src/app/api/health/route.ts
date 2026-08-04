import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getFirebaseAdminConfig } from "@/lib/config";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  try {
    await db.execute(sql`select 1` as never);
    checks.postgres = "ok";
  } catch (error) {
    checks.postgres = {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }

  const firebaseConfig = getFirebaseAdminConfig();
  checks.firebase = {
    status: firebaseConfig.projectId && firebaseConfig.clientEmail && firebaseConfig.privateKey ? "configured" : "missing-config",
    projectId: firebaseConfig.projectId || null,
  };

  return NextResponse.json(checks);
}
