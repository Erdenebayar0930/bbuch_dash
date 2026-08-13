import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { readDonationAccounts } from "@/lib/api/donationAccounts";
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
    const known = new Set(
      (await readDonationAccounts()).map((item) => item.number)
    );

    const parsed = parseTransactionInput(await request.json(), known);
    if (!parsed.ok) return badRequest(parsed.error);

    // MySQL нь UPDATE ... RETURNING дэмждэггүй — засаад буцааж уншина
    await db
      .update(transactions)
      .set({ ...parsed.values, updatedAt: new Date() })
      .where(eq(transactions.id, id));

    const [updated] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);

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
    // MySQL нь DELETE ... RETURNING дэмждэггүй — эхлээд байгаа эсэхийг шалгана
    const [existing] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);

    if (!existing) return notFound();

    await db.delete(transactions).where(eq(transactions.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "Гүйлгээ устгахад алдаа гарлаа");
  }
}
