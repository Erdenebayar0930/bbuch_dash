import { PassThrough, Readable } from "node:stream";

import { NextResponse } from "next/server";

import { forbidden, isAdminRole, requireActiveUser } from "@/lib/api/auth";
import { writeWorkbook } from "@/lib/api/excel";
import { datasets, findDataset } from "@/lib/api/exportDatasets";
import { rateLimit } from "@/lib/api/rateLimit";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Том татацад Passenger-ийн анхдагч таймаутад баригдахгүйн тулд */
export const maxDuration = 300;

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

  /**
   * Файл нь одоо урсгалаар бичигддэг тул санах ойн эрсдэл арилсан ч, `all`
   * нь бүх хүснэгтийг бүтнээр уншдаг хэвээр — сангийн ачааллаас хамгаална.
   * Хязгаар нь процесс бүрд тусдаа тул тоог нөөцтэйгээр сонгов.
   */
  const limited = rateLimit(request, {
    name: "export",
    limit: 3,
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

  const name = key === "all" ? "bid-tuslay-burtgel" : key;

  /**
   * Файлыг САНАХ ОЙД БҮТНЭЭР барихгүй, шууд хариу руу урсгана.
   *
   * `all` нь бүх багцыг агуулна: өмнө нь бүгдийг `Promise.all`-аар зэрэг
   * бэлдээд нэг Buffer болгодог байсан тул хамгийн их санах ойн хэрэглээ нь
   * бүх багцын НИЙЛБЭР байв. Одоо багц бүрийг ээлжлэн бэлдэж, бичээд суллана
   * — хэрэглээ нь хамгийн том ГАНЦ багцаар хязгаарлагдана.
   */
  const stream = new PassThrough();

  writeWorkbook(
    selected.map((item) => () => item!.build()),
    stream
  ).catch((error) => {
    /**
     * Толгой аль хэдийн илгээгдсэн тул 500 буцаах боломжгүй. Урсгалыг
     * таслахад клиент дутуу файл авна — Excel түүнийг эвдэрсэн гэж хэлнэ.
     * Чимээгүй хагас файл өгөхөөс энэ нь дээр.
     */
    console.error("[export] Excel үүсгэхэд алдаа гарлаа:", error);
    stream.destroy(error instanceof Error ? error : new Error(String(error)));
  });

  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": XLSX_TYPE,
      // filename* нь кирилл нэрийг зөв дамжуулна; энгийн filename нь нөөц
      "Content-Disposition": `attachment; filename="${name}-${today()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}