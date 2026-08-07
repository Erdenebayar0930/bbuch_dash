import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { readWelfareHousehold } from "@/lib/api/welfareInput";
import { db } from "@/lib/db";
import { welfareHouseholds } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/** Өрхийн мэдээллийг засна (зөвхөн админ). */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const parsed = readWelfareHousehold(
      await request.json().catch(() => ({})),
      true
    );
    if (!parsed.ok) return badRequest(parsed.error);

    if (Object.keys(parsed.value).length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    const [updated] = await db
      .update(welfareHouseholds)
      .set({ ...parsed.value, updatedAt: new Date() })
      .where(eq(welfareHouseholds.id, id))
      .returning();

    if (!updated) return notFound();

    return NextResponse.json({ household: updated });
  } catch (error) {
    return serverError(error, "Өрхийн мэдээлэл засахад алдаа гарлаа");
  }
}

/** Өрхийг устгана (зөвхөн админ). Халамжийн түүх нь дагаж устана. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const [deleted] = await db
      .delete(welfareHouseholds)
      .where(eq(welfareHouseholds.id, id))
      .returning({ id: welfareHouseholds.id });

    if (!deleted) return notFound();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Өрх устгахад алдаа гарлаа");
  }
}