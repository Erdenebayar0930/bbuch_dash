import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { givingMarks, givingPeople } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/**
 * Нэг сарыг «өргөсөн» / «өргөөгүй» болгоно — `{ month: "YYYY-MM", given }`.
 * Зөвхөн админ.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const month = typeof body.month === "string" ? body.month : "";
    if (!MONTH.test(month)) return badRequest("Сар YYYY-MM хэлбэртэй байна.");
    if (typeof body.given !== "boolean") return badRequest("given нь true/false байна.");

    const [person] = await db
      .select({ id: givingPeople.id })
      .from(givingPeople)
      .where(eq(givingPeople.id, id))
      .limit(1);
    if (!person) return notFound();

    if (body.given) {
      await db
        .insert(givingMarks)
        .values({ personId: id, month, markedBy: result.caller.uid })
        .onConflictDoNothing({ target: [givingMarks.personId, givingMarks.month] });
    } else {
      await db
        .delete(givingMarks)
        .where(and(eq(givingMarks.personId, id), eq(givingMarks.month, month)));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Тэмдэглэхэд алдаа гарлаа");
  }
}

/** Хүнийг жагсаалтаас хасна — тэмдэглэгээ нь хамт устна. Зөвхөн админ. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const deleted = await db
      .delete(givingPeople)
      .where(eq(givingPeople.id, id))
      .returning({ id: givingPeople.id });

    if (deleted.length === 0) return notFound();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Хасахад алдаа гарлаа");
  }
}
