import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireActiveUser,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import { db } from "@/lib/db";
import { assetChecks, assets, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Нэг хөрөнгийн түүхэнд буцаах шалгалтын дээд тоо */
const HISTORY_LIMIT = 20;

const statuses = new Set(["ok", "damaged", "short", "missing"]);

/** Тухайн хөрөнгийн шалгалтын түүх — сүүлийнх нь эхэндээ. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const rows = await db
      .select({
        id: assetChecks.id,
        status: assetChecks.status,
        foundQuantity: assetChecks.foundQuantity,
        note: assetChecks.note,
        checkedAt: assetChecks.checkedAt,
        checkedByName: users.firstName,
        checkedByLastName: users.lastName,
      })
      .from(assetChecks)
      .leftJoin(users, eq(assetChecks.checkedBy, users.uid))
      .where(eq(assetChecks.assetId, id))
      .orderBy(desc(assetChecks.checkedAt))
      .limit(HISTORY_LIMIT);

    return NextResponse.json({ checks: rows });
  } catch (error) {
    return serverError(error, "Шалгалтын түүх уншихад алдаа гарлаа");
  }
}

/**
 * Шинэ шалгалт бүртгэнэ (зөвхөн админ).
 *
 * Хуучин бүртгэлийг дарж бичихгүй — тооллого бүр тусдаа мөр болж үлдэнэ.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const body = (await request
      .json()
      .catch(() => ({}))) as Record<string, unknown>;

    if (typeof body.status !== "string" || !statuses.has(body.status)) {
      return badRequest("Төлөв буруу байна.");
    }

    const found = body.foundQuantity;
    if (
      typeof found !== "number" ||
      !Number.isInteger(found) ||
      found < 0 ||
      found > 1_000_000
    ) {
      return badRequest("Олдсон тоо 0-ээс их бүхэл тоо байна.");
    }

    const note = typeof body.note === "string" ? body.note.trim() : "";

    const [asset] = await db
      .select({ id: assets.id })
      .from(assets)
      .where(eq(assets.id, id))
      .limit(1);

    if (!asset) {
      return NextResponse.json(
        { error: "Эд хөрөнгө олдсонгүй." },
        { status: 404 }
      );
    }

    const [created] = await db
      .insert(assetChecks)
      .values({
        assetId: id,
        status: body.status,
        foundQuantity: found,
        note,
        checkedBy: result.caller.uid,
      })
      .returning();

    return NextResponse.json({ check: created });
  } catch (error) {
    return serverError(error, "Шалгалт бүртгэхэд алдаа гарлаа");
  }
}
