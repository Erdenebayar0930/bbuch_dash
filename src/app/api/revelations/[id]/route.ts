import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  forbidden,
  requireAimag,
  serverError,
} from "@/lib/api/auth";
import { readRevelation, readRevelationRow } from "@/lib/api/revelationInput";
import { revelationTable } from "@/lib/api/dataBoard";
import { db } from "@/lib/db";
import { isAdminRole } from "@/lib/permissions";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/**
 * Хүснэгт — `?aimag=tahilt` бол `tahilt.revelations`. Клиент нийтлэлийн
 * аймгийг мэддэг тул заана; заагаагүй бол үндсэн хүснэгт.
 */
const tableFor = (request: NextRequest) =>
  revelationTable(request.nextUrl.searchParams.get("aimag") ?? "");

/** Нийтлэлийн аймаг, бичсэн хүн, зургийг уншина — эрх шалгахад */
async function findRevelation(revelations: ReturnType<typeof tableFor>, id: string) {
  const [row] = await db
    .select({
      aimag: revelations.aimag,
      authorUid: revelations.authorUid,
      images: revelations.images,
    })
    .from(revelations)
    .where(eq(revelations.id, id))
    .limit(1);

  return row ?? null;
}

/** Нийтлэлийг засна — зөвхөн бичсэн хүн өөрөө. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const revelations = tableFor(request);

  try {
    const existing = await findRevelation(revelations, id);
    if (!existing) return notFound();

    const result = await requireAimag(request, existing.aimag);
    if ("error" in result) return result.error;

    const { caller } = result;
    if (existing.authorUid !== caller.uid) {
      return forbidden("Зөвхөн өөрийн нийтлэлээ засна.");
    }

    const parsed = readRevelation(
      await request.json().catch(() => ({})),
      caller.uid,
      (existing.images ?? []).map((image) => image.path)
    );
    if (!parsed.ok) return badRequest(parsed.error);

    await db
      .update(revelations)
      .set({ ...parsed.value, updatedAt: new Date() })
      .where(eq(revelations.id, id));

    return NextResponse.json({ revelation: await readRevelationRow(revelations, id) });
  } catch (error) {
    return serverError(error, "Илчлэл засахад алдаа гарлаа");
  }
}

/** Нийтлэлийг устгана — бичсэн хүн эсвэл админ. Зургийг клиент цэвэрлэнэ. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const revelations = tableFor(request);

  try {
    const existing = await findRevelation(revelations, id);
    if (!existing) return notFound();

    const result = await requireAimag(request, existing.aimag);
    if ("error" in result) return result.error;

    const { caller } = result;
    if (existing.authorUid !== caller.uid && !isAdminRole(caller.user?.role)) {
      return forbidden("Зөвхөн өөрийн нийтлэлээ устгана.");
    }

    await db.delete(revelations).where(eq(revelations.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Илчлэл устгахад алдаа гарлаа");
  }
}
