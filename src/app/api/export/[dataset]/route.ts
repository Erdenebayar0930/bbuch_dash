import { NextResponse } from "next/server";

import {
  forbidden,
  isAdminRole,
  requireActiveUser,
  serverError,
} from "@/lib/api/auth";
import { buildWorkbook } from "@/lib/api/excel";
import { datasets, findDataset } from "@/lib/api/exportDatasets";
import { rateLimit } from "@/lib/api/rateLimit";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Файлын нэрэнд орох YYYY-MM-DD — сервер дээрх огноогоор */
function today() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Бүртгэлийг .xlsx болгон татна.
 *
 * `/api/export/welfare` гэх мэт нэг багц, эсвэл `/api/export/all` — бүх багцыг
 * нэг файлын олон хуудас болгоно. Хувийн мэдээлэл агуулсан багц (хэрэглэгчид)
 * админаас өөр хүнд өгөгдөхгүй; `all` нь тэднийг агуулдаг тул мөн админы эрх.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ dataset: string }> }
) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  // `all` нь бүх хүснэгтийг санах ойд workbook болгож барина — давталтаар
  // дуудвал процессын санах ойг барагдуулж, серверийг унагаах боломжтой.
  const limited = rateLimit(request, {
    name: "export",
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { dataset: key } = await context.params;
  const isAdmin = isAdminRole(result.caller.user?.role);

  const selected = key === "all" ? datasets : [findDataset(key)].filter(Boolean);

  if (selected.length === 0) {
    return NextResponse.json({ error: "Ийм багц алга." }, { status: 404 });
  }

  if (!isAdmin && selected.some((item) => item!.adminOnly)) {
    return forbidden("Энэ багцыг зөвхөн админ татна.");
  }

  // Аймгийн багцыг зөвхөн тухайн аймгийн гишүүн татна — эс бөгөөс цэс, хуудсыг
  // хаачихаад Excel татацаар нь бүх өгөгдөл гоожно
  if (!isAdmin) {
    const mine = result.caller.user?.aimags ?? [];
    const blocked = selected.find(
      (item) => item!.aimag && !mine.includes(item!.aimag)
    );

    if (blocked) {
      return forbidden(
        `«${blocked.label}» багц таны харьяалагдах аймагт хамаарахгүй.`
      );
    }
  }

  try {
    const sheets = (
      await Promise.all(selected.map((item) => item!.build()))
    ).flat();

    const buffer = await buildWorkbook(sheets);
    const name = key === "all" ? "bbuch-burtgel" : key;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_TYPE,
        // filename* нь кирилл нэрийг зөв дамжуулна; энгийн filename нь нөөц
        "Content-Disposition": `attachment; filename="${name}-${today()}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return serverError(error, "Excel үүсгэхэд алдаа гарлаа");
  }
}