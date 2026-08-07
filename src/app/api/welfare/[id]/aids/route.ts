import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireActiveUser,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import { db } from "@/lib/db";
import { users, welfareAids, welfareHouseholds } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Нэг өрхийн түүхэнд буцаах бүртгэлийн дээд тоо */
const HISTORY_LIMIT = 20;

const MAX_DESCRIPTION = 200;
const MAX_NOTE = 400;
/** Зарцуулалтын дээд хязгаар, ₮ — андуурч тэг илүү бичихээс хамгаална */
const MAX_AMOUNT = 1_000_000_000;

/** Тухайн өрхөд үзүүлсэн халамжийн түүх — сүүлийнх нь эхэндээ. */
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
        id: welfareAids.id,
        description: welfareAids.description,
        amount: welfareAids.amount,
        note: welfareAids.note,
        providedAt: welfareAids.providedAt,
        providedByName: users.firstName,
        providedByLastName: users.lastName,
      })
      .from(welfareAids)
      .leftJoin(users, eq(welfareAids.providedBy, users.uid))
      .where(eq(welfareAids.householdId, id))
      .orderBy(desc(welfareAids.providedAt))
      .limit(HISTORY_LIMIT);

    return NextResponse.json({ aids: rows });
  } catch (error) {
    return serverError(error, "Халамжийн түүх уншихад алдаа гарлаа");
  }
}

/**
 * Шинэ халамжийн бүртгэл нэмнэ (зөвхөн админ).
 *
 * Хуучин бүртгэлийг дарж бичихгүй — тусламж бүр тусдаа мөр болж үлдэнэ.
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

    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    if (!description) return badRequest("Юу үзүүлснийг бичнэ үү.");
    if (description.length > MAX_DESCRIPTION) {
      return badRequest(`Тайлбар ${MAX_DESCRIPTION} тэмдэгтээс урт байж болохгүй.`);
    }

    // Мөнгөн бус тусламжид дүн шаардлагагүй — өгөөгүй бол 0
    const amount = body.amount ?? 0;
    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount < 0 ||
      amount > MAX_AMOUNT
    ) {
      return badRequest("Дүн 0-ээс их бүхэл тоо байна.");
    }

    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > MAX_NOTE) {
      return badRequest(`Тэмдэглэл ${MAX_NOTE} тэмдэгтээс урт байж болохгүй.`);
    }

    const [household] = await db
      .select({ id: welfareHouseholds.id })
      .from(welfareHouseholds)
      .where(eq(welfareHouseholds.id, id))
      .limit(1);

    if (!household) {
      return NextResponse.json({ error: "Өрх олдсонгүй." }, { status: 404 });
    }

    const [created] = await db
      .insert(welfareAids)
      .values({
        householdId: id,
        description,
        amount,
        note,
        providedBy: result.caller.uid,
      })
      .returning();

    return NextResponse.json({ aid: created });
  } catch (error) {
    return serverError(error, "Халамж бүртгэхэд алдаа гарлаа");
  }
}