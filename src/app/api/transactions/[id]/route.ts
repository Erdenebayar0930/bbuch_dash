import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { parseTransactionInput, toTransaction } from "@/lib/api/transactions";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () =>
  NextResponse.json({ error: "Гүйлгээ олдсонгүй." }, { status: 404 });

/** Гүйлгээг бүтнээр нь солино (зөвхөн админ). */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const parsed = parseTransactionInput(await request.json());
    if (!parsed.ok) return badRequest(parsed.error);

    const [updated] = await db
      .update(transactions)
      .set({ ...parsed.values, updatedAt: new Date() })
      .where(eq(transactions.id, id))
      .returning();

    if (!updated) return notFound();

    return NextResponse.json({ transaction: toTransaction(updated) });
  } catch (error) {
    return serverError(error, "Гүйлгээ шинэчлэхэд алдаа гарлаа");
  }
}

/** Гүйлгээг устгана (зөвхөн админ). */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const [deleted] = await db
      .delete(transactions)
      .where(eq(transactions.id, id))
      .returning();

    if (!deleted) return notFound();

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "Гүйлгээ устгахад алдаа гарлаа");
  }
}
