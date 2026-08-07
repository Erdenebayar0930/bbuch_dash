import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireActiveUser,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import { db } from "@/lib/db";
import { assetImages, assets } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Нэг эд хөрөнгөд зөвшөөрөх зургийн дээд тоо */
const MAX_IMAGES = 10;

/** Зөвхөн энэ төслийн Storage-аас ирсэн хаяг зөвшөөрнө */
const STORAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

function isStorageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && STORAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

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
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

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
        count: sql<number>`count(*)::int`,
        next: sql<number>`coalesce(max(${assetImages.position}), -1) + 1`,
      })
      .from(assetImages)
      .where(eq(assetImages.assetId, id));

    if (count >= MAX_IMAGES) {
      return badRequest(`Нэг эд хөрөнгөд ${MAX_IMAGES} хүртэл зураг оруулна.`);
    }

    const [created] = await db
      .insert(assetImages)
      .values({ assetId: id, url, path, position: next })
      .returning();

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
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const imageId = new URL(request.url).searchParams.get("imageId");
    if (!imageId) return badRequest("imageId шаардлагатай.");

    const [deleted] = await db
      .delete(assetImages)
      .where(and(eq(assetImages.id, imageId), eq(assetImages.assetId, id)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Зураг олдсонгүй." }, { status: 404 });
    }

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
