import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireActiveUser, requireAdmin, serverError } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { handbookDocuments } from "@/lib/db/schema";

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

/** Гарын авлагын баримтууд — дараалалаар. Идэвхтэй хэрэглэгч бүр уншина. */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select()
      .from(handbookDocuments)
      .orderBy(asc(handbookDocuments.position), asc(handbookDocuments.createdAt));

    return NextResponse.json({ documents: rows });
  } catch (error) {
    return serverError(error, "Гарын авлага уншихад алдаа гарлаа");
  }
}

/** Шинэ баримт нэмнэ — файлыг эхлээд Storage руу байршуулсны дараа. (зөвхөн админ) */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const body = await request.json().catch(() => ({}));
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const description =
      typeof body?.description === "string" ? body.description.trim() : "";
    const fileUrl = typeof body?.fileUrl === "string" ? body.fileUrl : "";
    const filePath = typeof body?.filePath === "string" ? body.filePath : "";
    const fileName = typeof body?.fileName === "string" ? body.fileName : "";
    const fileSize =
      typeof body?.fileSize === "number" && Number.isFinite(body.fileSize)
        ? Math.max(0, Math.round(body.fileSize))
        : 0;

    if (!title) return badRequest("Гарчгийг оруулна уу.");
    if (title.length > 255) return badRequest("Гарчиг 255 тэмдэгтээс урт байж болохгүй.");
    if (!fileUrl || !isStorageUrl(fileUrl)) {
      return badRequest("fileUrl нь Firebase Storage-ийн хаяг байх ёстой.");
    }
    if (!filePath) return badRequest("filePath заавал шаардлагатай.");

    const id = crypto.randomUUID();

    // Шинэ баримт сүүлд нь орно
    const [{ next }] = await db
      .select({
        next: sql<number>`coalesce(max(${handbookDocuments.position}), -1) + 1`,
      })
      .from(handbookDocuments);

    await db.insert(handbookDocuments).values({
      id,
      title,
      description,
      fileUrl,
      filePath,
      fileName,
      fileSize,
      position: next ?? 0,
      createdBy: result.caller.uid,
    });

    const [row] = await db
      .select()
      .from(handbookDocuments)
      .where(eq(handbookDocuments.id, id))
      .limit(1);

    return NextResponse.json({ document: row });
  } catch (error) {
    return serverError(error, "Баримт нэмэхэд алдаа гарлаа");
  }
}
