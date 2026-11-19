import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { welfareAimags } from "@/data/profileOptions";

import {
  badRequest,
  requireAimag,
  serverError,
} from "@/lib/api/auth";
import { boardOf, welfareTables } from "@/lib/api/dataBoard";
import { db } from "@/lib/db";
import { users, type VisitPhoto } from "@/lib/db/schema";
import { isStoredFileUrl } from "@/lib/storageUrl";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Халамжийг аль ч аймгийн гишүүн үзнэ — цэс нь аймаг бүрийн Тахилт доор */
const AIMAG = welfareAimags;

/** Нэг өрхийн түүхэнд буцаах бүртгэлийн дээд тоо */
const HISTORY_LIMIT = 20;

const MAX_DESCRIPTION = 200;
const MAX_NOTE = 400;
/** Зарцуулалтын дээд хязгаар, ₮ — андуурч тэг илүү бичихээс хамгаална */
const MAX_AMOUNT = 1_000_000_000;
/** Нэг удаагийн халамжид оруулах зургийн дээд тоо */
const MAX_PHOTOS = 3;

/**
 * Клиентийн илгээсэн зургийн жагсаалтыг шалгана. Буруу бол null.
 * Зам нь ЗААВАЛ тухайн өрхийн хавтас дотор байх ёстой — дурын URL шигтгэхгүй.
 */
function readPhotos(input: unknown, householdId: string): VisitPhoto[] | null {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length > MAX_PHOTOS) return null;

  const prefix = `welfare_aids/${householdId}/`;
  const photos: VisitPhoto[] = [];

  for (const item of input) {
    const { url, path } = (item ?? {}) as Record<string, unknown>;
    if (typeof url !== "string" || typeof path !== "string") return null;
    if (!path.startsWith(prefix) || path.includes("..")) return null;
    if (!isStoredFileUrl(url)) return null;
    photos.push({ url, path });
  }

  return photos;
}

/** Тухайн өрхөд үзүүлсэн халамжийн түүх — сүүлийнх нь эхэндээ. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const board = boardOf(request);
  const { aids: welfareAids } = welfareTables(board);
  const result = await requireAimag(request, board === "tahilt" ? "tahilt" : AIMAG);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const rows = await db
      .select({
        id: welfareAids.id,
        description: welfareAids.description,
        amount: welfareAids.amount,
        note: welfareAids.note,
        photos: welfareAids.photos,
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
 * Шинэ халамжийн бүртгэл нэмнэ (аймгийн гишүүн бүр).
 *
 * Хуучин бүртгэлийг дарж бичихгүй — тусламж бүр тусдаа мөр болж үлдэнэ.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const board = boardOf(request);
  const { households: welfareHouseholds, aids: welfareAids } = welfareTables(board);
  const result = await requireAimag(request, board === "tahilt" ? "tahilt" : AIMAG);
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

    const photos = readPhotos(body.photos, id);
    if (!photos) return badRequest(`Зураг ${MAX_PHOTOS} хүртэл, зөв замтай байна.`);

    const [household] = await db
      .select({ id: welfareHouseholds.id })
      .from(welfareHouseholds)
      .where(eq(welfareHouseholds.id, id))
      .limit(1);

    if (!household) {
      return NextResponse.json({ error: "Өрх олдсонгүй." }, { status: 404 });
    }

    // MySQL нь INSERT ... RETURNING дэмждэггүй — ID-г урьдчилж үүсгэнэ
    const aidId = crypto.randomUUID();

    await db.insert(welfareAids).values({
      id: aidId,
      householdId: id,
      description,
      amount,
      note,
      photos,
      providedBy: result.caller.uid,
    });

    const [created] = await db
      .select()
      .from(welfareAids)
      .where(eq(welfareAids.id, aidId));

    return NextResponse.json({ aid: created });
  } catch (error) {
    return serverError(error, "Халамж бүртгэхэд алдаа гарлаа");
  }
}