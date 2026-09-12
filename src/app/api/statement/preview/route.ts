import { NextResponse } from "next/server";

import { classifyMemo } from "@/data/titheOptions";
import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rateLimit";
import { parseStatement } from "@/lib/api/statement";
import { readTithePatterns } from "@/lib/api/tithePatterns";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Хуулгын файлын дээд хэмжээ */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Банкны дансны хуулгыг уншиж, гүйлгээ бүрийг «1/10» эсвэл «Өргөл» гэж
 * ангилаад буцаана.
 *
 * ЮУ Ч БИЧИХГҮЙ — уншсан үр дүнг зөвхөн харуулна. Буруу уншсан хуулга шууд
 * бааз руу орохгүй байх нь зорилго; хадгалах алхам нь тусад нь нэмэгдэнэ.
 */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  // 8 МБ хүртэлх файлыг задлан шинжилнэ — давталтаар илгээх нь CPU-г идэх
  // хамгийн хямд арга
  const limited = rateLimit(request, {
    name: "statement-preview",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return badRequest("Файл хавсаргаагүй байна.");
    }

    if (file.size === 0) return badRequest("Файл хоосон байна.");
    if (file.size > MAX_BYTES) {
      return badRequest("Файл хэт том байна (8MB-аас бага байх ёстой).");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseStatement(buffer);

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

    const rows = parsed.rows.map((row) => ({
      ...row,
      // Зөвхөн орлогыг 1/10 / өргөл гэж ялгана; зарлага хандив биш
      kind: row.type === "income" ? classifyMemo(row.memo, patterns) : "",
    }));

    return NextResponse.json({ rows, skipped: parsed.skipped, patterns });
  } catch (error) {
    return serverError(error, "Хуулга уншихад алдаа гарлаа");
  }
}
