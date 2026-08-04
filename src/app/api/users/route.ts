import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdmin, serverError } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Бүх хэрэглэгчийг жагсаана (зөвхөн админ). */
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const rows = await db.select().from(users).orderBy(desc(users.createdAt));
    return NextResponse.json({ users: rows });
  } catch (error) {
    return serverError(error, "Хэрэглэгчдийг уншихад алдаа гарлаа");
  }
}
