import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { readTithePatterns } from "@/lib/api/tithePatterns";
import { db } from "@/lib/db";
import { tithePatterns } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Нэг загварын дээд урт */
const MAX_LENGTH = 60;

/** Хэт олон загвар нь ангиллыг удаашруулж, санамсаргүй таарах эрсдэлтэй */
const MAX_PATTERNS = 100;

/** 1/10 таних загварууд (зөвхөн админ — хуулга уншуулах хэсэгт хэрэглэгдэнэ). */
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    return NextResponse.json({ patterns: await readTithePatterns() });
  } catch (error) {
    return serverError(error, "Загвар уншихад алдаа гарлаа");
  }
}

/** Шинэ загвар нэмнэ. Давхардсан бол чимээгүй алгасна. */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const body = await request.json();
    const pattern = String(body?.pattern ?? "").trim();

    if (!pattern) return badRequest("Загвар хоосон байна.");
    if (pattern.length > MAX_LENGTH) {
      return badRequest(`Загвар ${MAX_LENGTH} тэмдэгтээс богино байна.`);
    }

    const current = await readTithePatterns();
    if (current.length >= MAX_PATTERNS) {
      return badRequest(`Хамгийн ихдээ ${MAX_PATTERNS} загвар байна.`);
    }

    // Давхардвал юу ч хийхгүй — MySQL-д no-op update-ээр илэрхийлнэ
    await db
      .insert(tithePatterns)
      .values({ pattern })
      .onDuplicateKeyUpdate({ set: { pattern: sql`pattern` } });

    return NextResponse.json({ patterns: await readTithePatterns() });
  } catch (error) {
    return serverError(error, "Загвар нэмэхэд алдаа гарлаа");
  }
}

/** `?pattern=...` загварыг устгана. */
export async function DELETE(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const pattern = request.nextUrl.searchParams.get("pattern");
  if (!pattern) return badRequest("Устгах загварыг заагаагүй байна.");

  try {
    await db.delete(tithePatterns).where(eq(tithePatterns.pattern, pattern));

    return NextResponse.json({ patterns: await readTithePatterns() });
  } catch (error) {
    return serverError(error, "Загвар устгахад алдаа гарлаа");
  }
}
