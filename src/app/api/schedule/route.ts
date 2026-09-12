import { NextResponse } from "next/server";

import { badRequest, requireActiveUser, requireAdmin, serverError } from "@/lib/api/auth";
import { readSchedulePosterUrl, writeSchedulePosterUrl } from "@/lib/api/schedule";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

function isStorageImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && STORAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** Хянах самбарт харагдах постерын зураг — идэвхтэй хэрэглэгч бүрт нээлттэй. */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    return NextResponse.json({ imageUrl: await readSchedulePosterUrl() });
  } catch (error) {
    return serverError(error, "Хуваарийн зураг уншихад алдаа гарлаа");
  }
}

/** Зөвхөн админ постерын зургийг солино. */
export async function PUT(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const body = await request.json();
    const imageUrl = String((body as Record<string, unknown>)?.imageUrl ?? "");

    if (imageUrl !== "" && !isStorageImageUrl(imageUrl)) {
      return badRequest("imageUrl нь Firebase Storage-ийн хаяг байх ёстой.");
    }

    await writeSchedulePosterUrl(imageUrl);

    return NextResponse.json({ imageUrl });
  } catch (error) {
    return serverError(error, "Хуваарийн зураг хадгалахад алдаа гарлаа");
  }
}
