import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { classifyMemo } from "@/data/titheOptions";
import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { isKnownAccount } from "@/lib/api/donationAccounts";
import { parseStatement } from "@/lib/api/statement";
import { readTithePatterns } from "@/lib/api/tithePatterns";
import { db } from "@/lib/db";
import { donors, transactions } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Хуулгын файлын дээд хэмжээ */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Дансны хуулгыг уншиж, урьдчилан харуулах мөрүүдийг буцаана.
 *
 * ЮУ Ч БИЧИХГҮЙ — хэрэглэгч хүснэгтэн дээр нь ангилал, нэрийг засаад
 * баталгаажуулсны дараа `/api/statement/commit` бичнэ. Ингэснээр буруу
 * уншсан хуулга шууд бааз руу орохгүй.
 */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const form = await request.formData();
    const account = String(form.get("account") ?? "");
    const file = form.get("file");

    if (!(await isKnownAccount(account))) {
      return badRequest("Хуулга аль данснийх болохыг сонгоно уу.");
    }

    if (!(file instanceof File)) {
      return badRequest("Файл хавсаргаагүй байна.");
    }

    if (file.size === 0) return badRequest("Файл хоосон байна.");
    if (file.size > MAX_BYTES) {
      return badRequest("Файл хэт том байна (8MB-аас бага байх ёстой).");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseStatement(buffer, account);

    if (!parsed.ok) {
      // Олдсон толгойг мессежид шингээнэ — «багана олдсонгүй» гэдэг ганцаараа
      // юу буруу болсныг хэлэхгүй, харин файлын жинхэнэ толгойг харуулбал
      // хэрэглэгч (эсвэл бид) шалтгааныг шууд харна
      const headers = parsed.headers?.filter(Boolean) ?? [];
      const hint = headers.length
        ? ` Файлаас олдсон толгой: ${headers.slice(0, 12).join(" | ")}`
        : "";

      return NextResponse.json(
        { error: `${parsed.error}${hint}`, headers },
        { status: 400 }
      );
    }

    const patterns = await readTithePatterns();

    // Аль мөр нь аль хэдийн бичигдсэнийг нэг асуулгаар шалгана
    const keys = parsed.rows.map((row) => row.importKey);
    const existing = await db
      .select({ importKey: transactions.importKey })
      .from(transactions)
      .where(inArray(transactions.importKey, keys));

    const alreadySaved = new Set(existing.map((row) => row.importKey));

    // Бүртгэлтэй нэрсийг татаж, хуулгад ирсэн нэрийг дарж бичнэ: нэг удаа
    // зассан нэр дараагийн хуулгад өөрөө гарч ирэх ёстой
    const accounts = [
      ...new Set(parsed.rows.map((row) => row.donorAccount).filter(Boolean)),
    ];

    const known = accounts.length
      ? await db
          .select()
          .from(donors)
          .where(inArray(donors.accountNumber, accounts))
      : [];

    const nameByAccount = new Map(
      known.map((row) => [row.accountNumber, row.name])
    );

    const rows = parsed.rows.map((row) => {
      const registered = nameByAccount.get(row.donorAccount);

      return {
        ...row,
        donorName: registered ?? row.donorName,
        /** Нэр нь бүртгэлээс ирсэн үү — UI дээр ялгаж харуулна */
        fromRegistry: Boolean(registered),
        // Зөвхөн орлогыг 1/10 / өргөл гэж ялгана; зарлага хандив биш
        kind: row.type === "income" ? classifyMemo(row.memo, patterns) : "",
        duplicate: alreadySaved.has(row.importKey),
      };
    });

    return NextResponse.json({
      rows,
      skipped: parsed.skipped,
      patterns,
    });
  } catch (error) {
    return serverError(error, "Хуулга уншихад алдаа гарлаа");
  }
}
