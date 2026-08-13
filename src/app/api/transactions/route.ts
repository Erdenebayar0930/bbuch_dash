import { count, desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireActiveUser,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import {
  accessibleAccountNumbers,
  readDonationAccounts,
} from "@/lib/api/donationAccounts";
import { parseTransactionInput, toTransaction } from "@/lib/api/transactions";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Нэг дор татах дээд хязгаар */
const MAX_ITEMS = 2000;

/**
 * Гүйлгээний жагсаалт.
 *
 * Хэн хэдийг өргөсөн нь хувийн мэдээлэл тул зөвхөн ЭРХ ОЛГОГДСОН дансны
 * гүйлгээ буцна — админ бүгдийг харна. Данстай холбоогүй мөр (бэлэн мөнгө)
 * нь ямар ч дансны эрхэд хамаарахгүй тул зөвхөн админд харагдана.
 */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const allowed = await accessibleAccountNumbers(result.caller.user);

    // Нэг ч данс оноогдоогүй бол хоосон буцаана — бааз руу дэмий очихгүй
    if (allowed?.length === 0) {
      return NextResponse.json({ transactions: [], total: 0 });
    }

    const scope =
      allowed === null
        ? undefined
        : inArray(transactions.account, allowed);

    const rows = await db
      .select()
      .from(transactions)
      .where(scope)
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(MAX_ITEMS);

    const [total] = await db
      .select({ value: count() })
      .from(transactions)
      .where(scope);

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

    const known = new Set(
      (await readDonationAccounts()).map((item) => item.number)
    );

    // MySQL нь INSERT ... RETURNING дэмждэггүй тул ID-г урьдчилж үүсгээд,
    // оруулсны дараа тэдгээрээр нь буцааж уншина.
    const values = [];
    const ids: string[] = [];
    for (const row of rows) {
      const parsed = parseTransactionInput(row, known);
      if (!parsed.ok) return badRequest(parsed.error);
      const id = crypto.randomUUID();
      ids.push(id);
      values.push({ ...parsed.values, id, createdBy: result.caller.uid });
    }

    await db.insert(transactions).values(values);

    const insertedRows = await db
      .select()
      .from(transactions)
      .where(inArray(transactions.id, ids));

    // Хүсэлтэд ирсэн дарааллыг хадгална — select нь дарааллыг баталгаажуулдаггүй
    const byId = new Map(insertedRows.map((row) => [row.id, row]));
    const inserted = ids
      .map((id) => byId.get(id))
      .filter((row): row is (typeof insertedRows)[number] => Boolean(row));

    return NextResponse.json({
      transactions: inserted.map(toTransaction),
      count: inserted.length,
    });
  } catch (error) {
    return serverError(error, "Гүйлгээ нэмэхэд алдаа гарлаа");
  }
}
