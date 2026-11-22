import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireActiveUser, serverError } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { assetHistory, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Эд хөрөнгийн (ширхэгийн) өөрчлөлтийн түүх — шинээс хуучин руу. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const rows = await db
      .select({
        id: assetHistory.id,
        action: assetHistory.action,
        changes: assetHistory.changes,
        createdAt: assetHistory.createdAt,
        actorFirstName: users.firstName,
        actorLastName: users.lastName,
      })
      .from(assetHistory)
      .leftJoin(users, eq(assetHistory.actorUid, users.uid))
      .where(eq(assetHistory.assetId, id))
      .orderBy(desc(assetHistory.createdAt));

    return NextResponse.json({ history: rows });
  } catch (error) {
    return serverError(error, "Түүх уншихад алдаа гарлаа");
  }
}
