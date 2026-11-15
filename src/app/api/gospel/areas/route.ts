import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { gospelAimags } from "@/data/gospelOptions";
import { badRequest, requireAdmin, requireAimag, serverError } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { gospelAreas } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Бүх таб ба задаргаа — дарааллаар. Мод болгох ажлыг клиент хийнэ. */
export async function GET(request: NextRequest) {
  const result = await requireAimag(request, gospelAimags);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select({
        id: gospelAreas.id,
        parentId: gospelAreas.parentId,
        name: gospelAreas.name,
        position: gospelAreas.position,
      })
      .from(gospelAreas)
      .orderBy(asc(gospelAreas.position), asc(gospelAreas.createdAt));

    return NextResponse.json({ areas: rows });
  } catch (error) {
    return serverError(error, "Ангилал уншихад алдаа гарлаа");
  }
}

/**
 * Шинэ таб (`parentId`-гүй) эсвэл задаргаа нэмнэ — зөвхөн админ.
 * Задаргаа нь зөвхөн табын доор — гурав дахь түвшин үүсгэхгүй.
 */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const parentId: string | null = body.parentId ?? null;

    if (!name) return badRequest("Нэрээ оруулна уу.");
    if (name.length > 255) return badRequest("Нэр 255 тэмдэгтээс урт байж болохгүй.");

    if (parentId !== null) {
      if (typeof parentId !== "string" || !UUID.test(parentId)) {
        return badRequest("parentId буруу байна.");
      }

      const [parent] = await db
        .select({ parentId: gospelAreas.parentId })
        .from(gospelAreas)
        .where(eq(gospelAreas.id, parentId))
        .limit(1);

      if (!parent) return badRequest("Таб олдсонгүй.");
      if (parent.parentId) return badRequest("Задаргааны доор дахин задаргаа нэмэхгүй.");
    }

    // Жагсаалтын төгсгөлд нэмнэ
    const [{ next }] = await db
      .select({ next: sql<number>`(coalesce(max(${gospelAreas.position}), -1) + 1)::int` })
      .from(gospelAreas)
      .where(
        parentId === null
          ? sql`${gospelAreas.parentId} is null`
          : eq(gospelAreas.parentId, parentId)
      );

    const [area] = await db
      .insert(gospelAreas)
      .values({ name, parentId, position: next })
      .returning({
        id: gospelAreas.id,
        parentId: gospelAreas.parentId,
        name: gospelAreas.name,
        position: gospelAreas.position,
      });

    return NextResponse.json({ area });
  } catch (error) {
    return serverError(error, "Ангилал нэмэхэд алдаа гарлаа");
  }
}
