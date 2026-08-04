import { count, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireActiveUser,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import { parseTransactionInput, toTransaction } from "@/lib/api/transactions";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Нэг дор татах дээд хязгаар */
const MAX_ITEMS = 2000;

/** Гүйлгээний жагсаалт — нэвтэрсэн идэвхтэй хэрэглэгч уншина. */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(MAX_ITEMS);

    const [total] = await db.select({ value: count() }).from(transactions);

    return NextResponse.json({
      transactions: rows.map(toTransaction),
      total: total?.value ?? rows.length,
    });
  } catch (error) {
    return serverError(error, "Гүйлгээ уншихад алдаа гарлаа");
  }
}

/** Гүйлгээ нэмнэ (зөвхөн админ). Массив илгээвэл багцаар бичнэ. */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const body = await request.json();
    const rows = Array.isArray(body) ? body : [body];

    if (rows.length === 0) return badRequest("Бичих гүйлгээ алга.");

    const values = [];
    for (const row of rows) {
      const parsed = parseTransactionInput(row);
      if (!parsed.ok) return badRequest(parsed.error);
      values.push({ ...parsed.values, createdBy: result.caller.uid });
    }

    const inserted = await db.insert(transactions).values(values).returning();

    return NextResponse.json({
      transactions: inserted.map(toTransaction),
      count: inserted.length,
    });
  } catch (error) {
    return serverError(error, "Гүйлгээ нэмэхэд алдаа гарлаа");
  }
}
