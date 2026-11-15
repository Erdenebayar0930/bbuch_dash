import { eq, inArray, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { gospelAreas, gospelContacts } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/** Таб эсвэл задаргааны нэрийг засна — зөвхөн админ. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) return badRequest("Нэрээ оруулна уу.");
    if (name.length > 255) return badRequest("Нэр 255 тэмдэгтээс урт байж болохгүй.");

    const updated = await db
      .update(gospelAreas)
      .set({ name })
      .where(eq(gospelAreas.id, id))
      .returning({
        id: gospelAreas.id,
        parentId: gospelAreas.parentId,
        name: gospelAreas.name,
        position: gospelAreas.position,
      });

    if (updated.length === 0) return notFound();

    return NextResponse.json({ area: updated[0] });
  } catch (error) {
    return serverError(error, "Ангилал засахад алдаа гарлаа");
  }
}

/**
 * Таб эсвэл задаргааг хасна — зөвхөн админ.
 *
 * Табыг хасвал задаргаа нь хамт хасагдана. Аль нэгэнд нь бүртгэл байвал
 * хасахгүй: бүртгэлийг эхлээд өөр ангилал руу шилжүүлэх эсвэл устгах ёстой.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const affected = await db
      .select({ id: gospelAreas.id })
      .from(gospelAreas)
      .where(or(eq(gospelAreas.id, id), eq(gospelAreas.parentId, id)));

    if (!affected.some((row) => row.id === id)) return notFound();

    const [{ count }] = await db
      .select({ count: sql<number>`(count(*))::int` })
      .from(gospelContacts)
      .where(
        inArray(
          gospelContacts.areaId,
          affected.map((row) => row.id)
        )
      );

    if (count > 0) {
      return NextResponse.json(
        {
          error: `Энэ ангилалд ${count} бүртгэл байгаа тул хасах боломжгүй. Бүртгэлүүдийг өөр ангилал руу шилжүүлсний дараа хасна уу.`,
        },
        { status: 409 }
      );
    }

    await db.delete(gospelAreas).where(eq(gospelAreas.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Ангилал хасахад алдаа гарлаа");
  }
}
