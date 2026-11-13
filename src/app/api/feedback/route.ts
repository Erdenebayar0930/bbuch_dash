import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireActiveUser, serverError } from "@/lib/api/auth";
import { MAX_FEEDBACK_IMAGES } from "@/data/feedbackOptions";
import { aimags as aimagOptions, isValidOption } from "@/data/profileOptions";
import { isAdminRole } from "@/lib/permissions";
import { feedbackColumns, readFeedback } from "@/lib/api/feedback";
import { db } from "@/lib/db";
import { feedback, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/** Бүх санал хүсэлт — нийтэд нээлттэй, шинэ нь эхэндээ. */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select(feedbackColumns)
      .from(feedback)
      .leftJoin(users, eq(feedback.authorUid, users.uid))
      .orderBy(desc(feedback.createdAt));

    return NextResponse.json({ feedback: rows });
  } catch (error) {
    return serverError(error, "Санал хүсэлт уншихад алдаа гарлаа");
  }
}

/**
 * Шинэ санал хүсэлт — идэвхтэй хэрэглэгч бүр. Зургийг клиент эхлээд
 * Storage-ийн `feedback/{өөрийн uid}/` хавтас руу байршуулсан байна.
 */
export async function POST(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const body = await request.json().catch(() => ({}));
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const text = typeof body?.body === "string" ? body.body.trim() : "";
    const rawImages: unknown[] = Array.isArray(body?.images) ? body.images : [];
    const aimag = typeof body?.aimag === "string" ? body.aimag : "";

    // "" = хувь хүнээс. Аймгийн нэрээр зөвхөн тэр аймгийн гишүүн (эсвэл
    // админ) бичнэ — өөр аймгийн нэр барьж санал оруулахаас сэргийлнэ.
    if (!isValidOption(aimagOptions, aimag)) {
      return badRequest("Аймаг буруу байна.");
    }
    if (
      aimag &&
      !isAdminRole(result.caller.user?.role) &&
      !(result.caller.user?.aimags ?? []).includes(aimag)
    ) {
      return badRequest("Та энэ аймагт харьяалагдахгүй байна.");
    }

    if (!title) return badRequest("Гарчгийг оруулна уу.");
    if (title.length > 255) {
      return badRequest("Гарчиг 255 тэмдэгтээс урт байж болохгүй.");
    }
    if (text.length > 5000) {
      return badRequest("Тайлбар 5000 тэмдэгтээс урт байж болохгүй.");
    }
    if (rawImages.length > MAX_FEEDBACK_IMAGES) {
      return badRequest(`Хамгийн ихдээ ${MAX_FEEDBACK_IMAGES} зураг оруулна.`);
    }

    // Зөвхөн өөрийн хавтас дахь зургийг хүлээн авна — өөр хүний файлыг
    // өөрийн санал дээр холбож, дараа нь устгуулахаас сэргийлнэ
    const ownPrefix = `feedback/${result.caller.uid}/`;
    const images: { url: string; path: string }[] = [];

    for (const item of rawImages) {
      const url = (item as { url?: unknown })?.url;
      const path = (item as { path?: unknown })?.path;

      if (
        typeof url !== "string" ||
        typeof path !== "string" ||
        !isStorageUrl(url) ||
        !path.startsWith(ownPrefix) ||
        path.includes("..")
      ) {
        return badRequest("Зургийн мэдээлэл буруу байна.");
      }
      images.push({ url, path });
    }

    const id = crypto.randomUUID();

    await db.insert(feedback).values({
      id,
      authorUid: result.caller.uid,
      aimag,
      title,
      body: text,
      images,
    });

    return NextResponse.json({ feedback: await readFeedback(id) });
  } catch (error) {
    return serverError(error, "Санал хүсэлт илгээхэд алдаа гарлаа");
  }
}
