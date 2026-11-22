import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { recordAssetImage } from "@/lib/api/assetHistory";

import {
  badRequest,
  requireActiveUser,
  serverError,
} from "@/lib/api/auth";
import { requireAssetEditor } from "@/lib/api/assetAccess";
import { db } from "@/lib/db";
import { assetImages, assets } from "@/lib/db/schema";

import type { NextRequest } from "next/server";
import { isStoredFileUrl } from "@/lib/storageUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Нэг эд хөрөнгөд зөвшөөрөх зургийн дээд тоо */
const MAX_IMAGES = 10;

/** Зөвхөн энэ төслийн Storage-аас ирсэн хаяг зөвшөөрнө */
/** Сервер дээрх (`/uploads/...`) эсвэл Firebase-д үлдсэн хуучин файл */
const isStorageUrl = isStoredFileUrl;

/**
 * Байршуулсан зургийг бүртгэлд холбоно (зөвхөн админ).
 *
 * Файлыг клиент шууд Storage руу тавьдаг — Storage дүрэм нь Postgres дэх
 * role-ыг харж чаддаггүй тул "хэн бүртгэлд холбож болох" шийдвэрийг ЭНД гаргана.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  // Админ эсвэл Магтаалын аймгийн гишүүн (тухайн хөрөнгө Магтаалынх байх)
  const result = await requireAssetEditor(request, id);
  if ("error" in result) return result.error;

  try {
    const body = (await request
      .json()
      .catch(() => ({}))) as Record<string, unknown>;

    const url = typeof body.url === "string" ? body.url : "";
    const path = typeof body.path === "string" ? body.path.trim() : "";

    if (!url || !isStorageUrl(url)) {
      return badRequest("url нь Firebase Storage-ийн хаяг байх ёстой.");
    }
    // Зам нь тухайн хөрөнгийн хавтсанд байх ёстой — өөр хавтас руу заахаас сэргийлнэ
    if (!path.startsWith(`assets/${id}/`)) {
      return badRequest("path буруу байна.");
    }

    const [asset] = await db
      .select({ id: assets.id })
      .from(assets)
      .where(eq(assets.id, id))
      .limit(1);

    if (!asset) {
      return NextResponse.json({ error: "Эд хөрөнгө олдсонгүй." }, { status: 404 });
    }

    const [{ count, next }] = await db
      .select({
        count: sql<number>`(count(*))::int`,
        next: sql<number>`coalesce(max(${assetImages.position}), -1) + 1`,
      })
      .from(assetImages)
      .where(eq(assetImages.assetId, id));

    if (count >= MAX_IMAGES) {
      return badRequest(`Нэг эд хөрөнгөд ${MAX_IMAGES} хүртэл зураг оруулна.`);
    }

    // MySQL нь INSERT ... RETURNING дэмждэггүй — ID-г урьдчилж үүсгэнэ
    const imageId = crypto.randomUUID();

    await db
      .insert(assetImages)
      .values({ id: imageId, assetId: id, url, path, position: next });

    const [created] = await db
      .select()
      .from(assetImages)
      .where(eq(assetImages.id, imageId));

    await recordAssetImage(id, true, result.caller.uid);

    return NextResponse.json({ image: created });
  } catch (error) {
    return serverError(error, "Зураг бүртгэхэд алдаа гарлаа");
  }
}

/** Зургийн бүртгэлийг устгана (файлыг клиент Storage-оос устгана). */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  // Админ эсвэл Магтаалын аймгийн гишүүн (тухайн хөрөнгө Магтаалынх байх)
  const result = await requireAssetEditor(request, id);
  if ("error" in result) return result.error;

  try {
    const imageId = new URL(request.url).searchParams.get("imageId");
    if (!imageId) return badRequest("imageId шаардлагатай.");

    // MySQL нь DELETE ... RETURNING дэмждэггүй. Клиентэд Storage-ийн зам
    // хэрэгтэй тул устгахын ӨМНӨ мөрийг уншиж авна.
    const [deleted] = await db
      .select()
      .from(assetImages)
      .where(and(eq(assetImages.id, imageId), eq(assetImages.assetId, id)))
      .limit(1);

    if (!deleted) {
      return NextResponse.json({ error: "Зураг олдсонгүй." }, { status: 404 });
    }

    // Эд хөрөнгө заавал зурагтай — сүүлийн зургийг устгахгүй (эхлээд шинийг нэмнэ)
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(assetImages)
      .where(eq(assetImages.assetId, id));
    if (n <= 1) {
      return badRequest("Эд хөрөнгө заавал зурагтай байна — эхлээд шинэ зураг нэмээд дараа нь энийг устгана уу.");
    }

    await db
      .delete(assetImages)
      .where(and(eq(assetImages.id, imageId), eq(assetImages.assetId, id)));

    await recordAssetImage(id, false, result.caller.uid);

    // Клиент файлыг Storage-оос устгахын тулд замыг буцаана
    return NextResponse.json({ path: deleted.path });
  } catch (error) {
    return serverError(error, "Зураг устгахад алдаа гарлаа");
  }
}

/** Тухайн хөрөнгийн зургууд — эрэмбээр (харахад админ байх шаардлагагүй). */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const rows = await db
      .select()
      .from(assetImages)
      .where(eq(assetImages.assetId, id))
      .orderBy(asc(assetImages.position));

    return NextResponse.json({ images: rows });
  } catch (error) {
    return serverError(error, "Зураг уншихад алдаа гарлаа");
  }
}
