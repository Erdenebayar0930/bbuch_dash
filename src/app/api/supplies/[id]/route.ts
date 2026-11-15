import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { readSupply } from "@/lib/api/supplyInput";
import { db } from "@/lib/db";
import { churchSupplies } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/** Бүртгэлийг засна — зөвхөн админ. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const parsed = readSupply(await request.json().catch(() => ({})), true);
    if (!parsed.ok) return badRequest(parsed.error);
    if (Object.keys(parsed.value).length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    const [updated] = await db
      .update(churchSupplies)
      .set({ ...parsed.value, updatedAt: new Date() })
      .where(eq(churchSupplies.id, id))
      .returning();

    if (!updated) return notFound();
    return NextResponse.json({ supply: updated });
  } catch (error) {
    return serverError(error, "Хангамж засахад алдаа гарлаа");
  }
}

/** Бүртгэлийг устгана — зөвхөн админ. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const deleted = await db
      .delete(churchSupplies)
      .where(eq(churchSupplies.id, id))
      .returning({ id: churchSupplies.id });

    if (deleted.length === 0) return notFound();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Хангамж устгахад алдаа гарлаа");
  }
}
