import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { isVisitStatus } from "@/data/donationBoxOptions";
import {
  badRequest,
  requireActiveUser,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import { db } from "@/lib/db";
import { donationBoxVisits, donationBoxes, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Нэг хайрцгийн түүхэнд буцаах эргэлтийн дээд тоо */
const HISTORY_LIMIT = 20;

/** Хураасан дүнгийн дээд хязгаар, ₮ — андуурч тэг илүү бичихээс хамгаална */
const MAX_AMOUNT = 1_000_000_000;

/** Нэг эргэлтээр хураах хувцасны боломжит дээд тоо, ширхэг */
const MAX_CLOTHING = 100_000;

/** Тухайн хайрцгийн эргэлтийн түүх — сүүлийнх нь эхэндээ. */
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
        id: donationBoxVisits.id,
        status: donationBoxVisits.status,
        amount: donationBoxVisits.amount,
        clothingCount: donationBoxVisits.clothingCount,
        note: donationBoxVisits.note,
        visitedAt: donationBoxVisits.visitedAt,
        visitedByName: users.firstName,
        visitedByLastName: users.lastName,
      })
      .from(donationBoxVisits)
      .leftJoin(users, eq(donationBoxVisits.visitedBy, users.uid))
      .where(eq(donationBoxVisits.boxId, id))
      .orderBy(desc(donationBoxVisits.visitedAt))
      .limit(HISTORY_LIMIT);

    return NextResponse.json({ visits: rows });
  } catch (error) {
    return serverError(error, "Эргэлтийн түүх уншихад алдаа гарлаа");
  }
}

/**
 * Шинэ эргэлт бүртгэнэ (зөвхөн админ).
 *
 * Хуучин бүртгэлийг дарж бичихгүй — эргэлт бүр тусдаа мөр болж үлдэнэ.
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

    if (!isVisitStatus(body.status)) return badRequest("Төлөв буруу байна.");

    const amount = body.amount;
    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount < 0 ||
      amount > MAX_AMOUNT
    ) {
      return badRequest("Хураасан дүн 0-ээс их бүхэл тоо байна.");
    }

    // Хувцас нь заавал биш — өгөөгүй бол 0
    const clothingCount = body.clothingCount ?? 0;
    if (
      typeof clothingCount !== "number" ||
      !Number.isInteger(clothingCount) ||
      clothingCount < 0 ||
      clothingCount > MAX_CLOTHING
    ) {
      return badRequest("Хувцасны тоо 0-ээс их бүхэл тоо байна.");
    }

    // Хоосон байсан эргэлтэд юу ч хураагдсан байх учиргүй — зөрчилтэй бүртгэл
    // тайланг гуйвуулна
    if (body.status !== "collected" && (amount !== 0 || clothingCount !== 0)) {
      return badRequest("Хураагаагүй эргэлтэд хураалт бүртгэх боломжгүй.");
    }

    const note = typeof body.note === "string" ? body.note.trim() : "";

    const [box] = await db
      .select({ id: donationBoxes.id })
      .from(donationBoxes)
      .where(eq(donationBoxes.id, id))
      .limit(1);

    if (!box) {
      return NextResponse.json({ error: "Хайрцаг олдсонгүй." }, { status: 404 });
    }

    const [created] = await db
      .insert(donationBoxVisits)
      .values({
        boxId: id,
        status: body.status,
        amount,
        clothingCount,
        note,
        visitedBy: result.caller.uid,
      })
      .returning();

    return NextResponse.json({ visit: created });
  } catch (error) {
    return serverError(error, "Эргэлт бүртгэхэд алдаа гарлаа");
  }
}