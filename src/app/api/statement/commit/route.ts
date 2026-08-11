import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { donationKinds } from "@/data/titheOptions";
import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { isKnownAccount } from "@/lib/api/donationAccounts";
import { db } from "@/lib/db";
import { donors, transactions } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Нэг удаад баталгаажуулж болох мөрийн дээд тоо */
const MAX_ROWS = 5000;

const MAX_TEXT = 300;

const types = new Set(["income", "expense"]);
const kinds = new Set<string>([...donationKinds, ""]);

type Ready = {
  date: string;
  description: string;
  category: string;
  type: string;
  amount: string;
  donorAccount: string;
  donorName: string;
  importKey: string;
};

type RowResult = { ok: true; value: Ready } | { ok: false; error: string };

/** Клиентээс ирсэн нэг мөрийг шалгаад бичих хэлбэрт буулгана */
function readRow(input: unknown, index: number): RowResult {
  const fail = (message: string): RowResult => ({
    ok: false,
    error: `${index + 1}-р мөр: ${message}`,
  });

  if (typeof input !== "object" || input === null) {
    return fail("буруу хэлбэртэй байна.");
  }

  const row = input as Record<string, unknown>;

  const importKey = String(row.importKey ?? "");
  // Түлхүүрийг сервер тал үүсгэдэг — клиент дур мэдэн зохиовол давхардлын
  // хамгаалалт утгагүй болно, тиймээс хэлбэрийг нь шалгана
  if (!/^[0-9a-f]{40}$/.test(importKey)) {
    return fail("давхардлын түлхүүр буруу байна.");
  }

  const date = String(row.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return fail("огноо YYYY-MM-DD хэлбэртэй байх ёстой.");
  }

  const type = String(row.type ?? "");
  if (!types.has(type)) return fail("төрөл нь income эсвэл expense байна.");

  const amount = Number(row.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail("дүн 0-ээс их тоо байх ёстой.");
  }

  const category = String(row.kind ?? "");
  if (!kinds.has(category)) return fail("ангилал буруу байна.");

  const description = String(row.memo ?? "").slice(0, MAX_TEXT);
  const donorAccount = String(row.donorAccount ?? "").slice(0, MAX_TEXT);
  const donorName = String(row.donorName ?? "").slice(0, MAX_TEXT);

  return {
    ok: true,
    value: {
      date,
      description,
      category,
      type,
      amount: amount.toFixed(2),
      donorAccount,
      donorName,
      importKey,
    },
  };
}

/**
 * Баталгаажуулсан хуулгын мөрүүдийг хадгална.
 *
 * Хоёр зүйл нэг дор болно:
 *  1. Гүйлгээ бичигдэнэ — `import_key` давхцвал ЧИМЭЭГҮЙ алгасна, тиймээс нэг
 *     хуулгыг хоёр удаа уншуулсан ч давхар мөр үүсэхгүй.
 *  2. Данс эзэмшигчийн нэр `donors` бүртгэлд шинэчлэгдэнэ — дараагийн хуулгад
 *     ижил данс тааралдвал нэр нь өөрөө гарч ирнэ.
 */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const body = await request.json();
    const account = String(body?.account ?? "");
    const input = body?.rows;

    if (!(await isKnownAccount(account))) {
      return badRequest("Хуулга аль данснийх болохыг сонгоно уу.");
    }

    if (!Array.isArray(input) || input.length === 0) {
      return badRequest("Хадгалах мөр алга.");
    }

    if (input.length > MAX_ROWS) {
      return badRequest(`Нэг удаад ${MAX_ROWS} хүртэл мөр хадгална.`);
    }

    const values: Ready[] = [];
    for (const [index, row] of input.entries()) {
      const parsed = readRow(row, index);
      if (!parsed.ok) return badRequest(parsed.error);
      values.push(parsed.value);
    }

    const inserted = await db
      .insert(transactions)
      .values(
        values.map((value) => ({
          ...value,
          status: "approved",
          account,
          createdBy: result.caller.uid,
        }))
      )
      // Давхардсаныг алгасна — уншуулсан бүрд шинэчлэхгүй: хэрэглэгч гараар
      // зассан хуучин мөрийг хуулга дарж бичих нь алдагдал болно
      .onConflictDoNothing({ target: transactions.importKey })
      .returning({ id: transactions.id });

    // Нэг данс нэг л удаа орно — ON CONFLICT нэг мөрийг хоёр удаа хөндөж
    // чадахгүй тул давхардлыг урьдчилж арилгана. Сүүлийн нэр ялна.
    const byAccount = new Map<string, string>();
    for (const value of values) {
      if (!value.donorAccount || !value.donorName) continue;
      byAccount.set(value.donorAccount, value.donorName);
    }

    if (byAccount.size > 0) {
      await db
        .insert(donors)
        .values(
          [...byAccount].map(([accountNumber, name]) => ({
            accountNumber,
            name,
          }))
        )
        .onConflictDoUpdate({
          target: donors.accountNumber,
          set: { name: sql`excluded.name`, updatedAt: new Date() },
        });
    }

    return NextResponse.json({
      saved: inserted.length,
      skipped: values.length - inserted.length,
      donors: byAccount.size,
    });
  } catch (error) {
    return serverError(error, "Хуулга хадгалахад алдаа гарлаа");
  }
}
