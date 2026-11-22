import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireActiveUser, serverError } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Идэвхтэй гишүүдийн овог нэр — нийтлэлд нэр цохох сонголтод. Идэвхтэй
 * хэрэглэгч бүр уншина; утас, имэйл зэрэг бусад мэдээлэл гарахгүй.
 */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select({ uid: users.uid, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.status, "active"))
      .orderBy(asc(users.firstName));

    return NextResponse.json({
      users: rows
        .map((row) => ({
          uid: row.uid,
          name: [row.lastName, row.firstName].filter(Boolean).join(" ").trim(),
        }))
        .filter((row) => row.name),
    });
  } catch (error) {
    return serverError(error, "Гишүүдийн нэрийг уншихад алдаа гарлаа");
  }
}
