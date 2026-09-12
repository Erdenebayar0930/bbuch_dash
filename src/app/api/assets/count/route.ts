import { desc, eq, gte, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireActiveUser, requireAdmin, serverError } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { assetChecks, assetCountSessions } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Идэвхтэй тооллого — байхгүй бол null */
async function activeSession() {
  const [session] = await db
    .select()
    .from(assetCountSessions)
    .where(isNull(assetCountSessions.endedAt))
    .orderBy(desc(assetCountSessions.startedAt))
    .limit(1);

  return session ?? null;
}

/**
 * Идэвхтэй тооллого ба түүний явцад тоологдсон хөрөнгүүд.
 *
 * Тоологдсон гэдгийг тусад нь хадгалахгүй — тооллого эхэлснээс хойш шалгалт
 * бүртгэгдсэн хөрөнгө бүрийг тоологдсонд тооцно.
 */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const session = await activeSession();

    if (!session) {
      return NextResponse.json({ session: null, checkedAssetIds: [] });
    }

    const rows = await db
      .selectDistinct({ assetId: assetChecks.assetId })
      .from(assetChecks)
      .where(gte(assetChecks.checkedAt, session.startedAt));

    return NextResponse.json({
      session,
      checkedAssetIds: rows.map((row) => row.assetId),
    });
  } catch (error) {
    return serverError(error, "Тооллогын мэдээлэл уншихад алдаа гарлаа");
  }
}

/** Шинэ тооллого эхлүүлнэ (зөвхөн админ). */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    if (await activeSession()) {
      return badRequest("Тооллого аль хэдийн эхэлсэн байна.");
    }

    // MySQL нь INSERT ... RETURNING дэмждэггүй — ID-г урьдчилж үүсгэнэ
    const id = crypto.randomUUID();

    await db
      .insert(assetCountSessions)
      .values({ id, startedBy: result.caller.uid });

    const [created] = await db
      .select()
      .from(assetCountSessions)
      .where(eq(assetCountSessions.id, id));

    return NextResponse.json({ session: created, checkedAssetIds: [] });
  } catch (error) {
    return serverError(error, "Тооллого эхлүүлэхэд алдаа гарлаа");
  }
}

/** Идэвхтэй тооллогыг дуусгана (зөвхөн админ). */
export async function PATCH(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const session = await activeSession();
    if (!session) return badRequest("Идэвхтэй тооллого алга.");

    await db
      .update(assetCountSessions)
      .set({ endedAt: sql`now()` })
      .where(isNull(assetCountSessions.endedAt));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Тооллого дуусгахад алдаа гарлаа");
  }
}
