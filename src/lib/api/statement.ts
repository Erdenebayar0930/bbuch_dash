import "server-only";

import { createHash } from "node:crypto";

import ExcelJS from "exceljs";

import { normalizeMemo } from "@/data/titheOptions";

/**
 * Банкны дансны хуулгыг (.xlsx) уншиж, гүйлгээний мөр болгон задална.
 *
 * Банк бүр багануудаа өөрөөр нэрлэдэг тул байрлалаар нь биш ТОЛГОЙН НЭРЭЭР
 * таана. Толгой мөр нь эхний мөр байх албагүй — хуулгын эхэнд данс, эзэмшигч,
 * хугацааны мэдээлэл ордог тул эхний хэдэн мөрийг сканнердаж хамгийн олон
 * багана таарсныг нь толгой гэж үзнэ.
 */

/** Толгой мөрийг эрж хайх дээд гүн */
const HEADER_SCAN_ROWS = 40;

/** Нэг удаад уншиж болох мөрийн дээд тоо */
const MAX_ROWS = 5000;

/** Багана таних түлхүүр үгс — жижиг үсэг, зайгүй болгож харьцуулна */
const COLUMN_SYNONYMS = {
  date: ["огноо", "гүйлгээнийогноо", "онсарөдөр", "date", "trndate", "гүйлгээхийсэногноо"],
  memo: [
    "гүйлгээнийутга",
    "утга",
    "гүйлгээнийтайлбар",
    "тайлбар",
    "гүйлгээнийтөрөл",
    "description",
    "narrative",
    "details",
    "purpose",
  ],
  income: ["орлого", "орлогындүн", "credit", "creditamount", "цэвэрорлого"],
  expense: ["зарлага", "зарлагындүн", "debit", "debitamount"],
  amount: ["дүн", "гүйлгээнийдүн", "amount", "мөнгөндүн", "нийтдүн"],
  donorAccount: [
    "харьцсандансныдугаар",
    "харьцсанданс",
    "харьцсандансдугаар",
    "хариуданс",
    "дансныдугаар",
    "counterpartyaccount",
    "account",
  ],
  donorName: [
    "харьцсандансэзэмшигч",
    "харьцсандансныэзэмшигч",
    "харьцсандансныэзэмшигчийннэр",
    "дансэзэмшигч",
    "дансныэзэмшигчийннэр",
    "эзэмшигчийннэр",
    "эзэмшигч",
    "гүйлгээхийсэн",
    "харилцагчийннэр",
    "харилцагч",
    "counterpartyname",
    "name",
  ],
} as const;

type ColumnKey = keyof typeof COLUMN_SYNONYMS;

/** Толгойн нэрийг харьцуулах хэлбэрт буулгана */
const normalizeHeader = (value: string) =>
  value.toLowerCase().replace(/[\s.,:;_()[\]/\\-]/g, "");

/**
 * Нүдний утгыг текст болгоно.
 *
 * ExcelJS нь томьёо, холбоос, өнгөт текстийг объектоор буцаадаг тул
 * `String(value)` шууд хийвэл «[object Object]» гарна.
 */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return value.hyperlink;
    }
    return "";
  }
  return String(value).trim();
}

/** Excel-ийн 1900 оны серийн дугаарыг огноо болгоно */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

/**
 * Нүднээс YYYY-MM-DD огноо гаргана. Танихгүй хэлбэр бол хоосон мөр.
 *
 * Хуулгад огноо нь Date объект, Excel серийн тоо, эсвэл «2026.01.15»,
 * «15/01/2026» гэх мэт текст байж болно — гурвуулангийг барина.
 */
function readDate(value: ExcelJS.CellValue): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  if (typeof value === "number" && value > 0 && value < 100_000) {
    return new Date(EXCEL_EPOCH + value * MS_PER_DAY)
      .toISOString()
      .slice(0, 10);
  }

  const text = cellText(value);
  if (!text) return "";

  // Цагтай ирвэл эхний хэсгийг л авна: «2026-01-15 13:04:22»
  const head = text.split(/[\sT]/)[0];

  const iso = head.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const dmy = head.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return "";
}

/**
 * Мөнгөн дүнг тоо болгоно. «1,250,000.00», «1 250 000₮» зэргийг барина.
 * Уншигдахгүй бол 0 — тэглэсэн мөрийг доор нь алгасна.
 */
function readAmount(value: ExcelJS.CellValue): number {
  if (typeof value === "number") return value;

  const text = cellText(value).replace(/[^\d,.-]/g, "");
  if (!text) return 0;

  // Мянгатын таслалыг хасаад аравтын цэгийг үлдээнэ
  const cleaned = text.replace(/,/g, "");
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

export type StatementRow = {
  /** Файл доторх мөрийн дугаар — алдааг заахад хэрэгтэй */
  rowNumber: number;
  date: string;
  memo: string;
  /** Үргэлж эерэг */
  amount: number;
  type: "income" | "expense";
  donorAccount: string;
  donorName: string;
  /** Давхардлыг барих түлхүүр */
  importKey: string;
};

export type ParseStatementResult =
  | { ok: false; error: string; headers?: string[] }
  | { ok: true; rows: StatementRow[]; skipped: number };

/**
 * Хуулгын нэг мөрийг давхардлаас хамгаалах түлхүүр.
 *
 * Ижил хүн, ижил өдөр, ижил дүнгээр хоёр удаа шилжүүлэх нь бодит байдалд
 * тохиолддог тул давтагдсан мөрийг ялгах дугаарыг (`seq`) оруулна. Нэг файлыг
 * дахин уншуулбал дараалал нь ижил гарах тул түлхүүр давтагдаж, давхар
 * бичигдэхгүй.
 */
function buildImportKey(
  churchAccount: string,
  row: Omit<StatementRow, "importKey" | "rowNumber">,
  seq: number
): string {
  const parts = [
    churchAccount,
    row.date,
    row.type,
    row.amount.toFixed(2),
    row.donorAccount,
    normalizeMemo(row.memo),
    String(seq),
  ].join("|");

  return createHash("sha256").update(parts).digest("hex").slice(0, 40);
}

/**
 * Файлын эхний байтуудаар нь жинхэнэ хэлбэрийг нь тогтооно.
 *
 * Өргөтгөлд итгэж болохгүй: банкны апп «.xls» нэртэй ч дотроо огт өөр
 * хэлбэртэй файл өгдөг. Буруу хэлбэрийг эрт барьж, юу хийхийг нь хэлэхгүй
 * бол хэрэглэгч «уншиж чадсангүй» гэсэн ойлгомжгүй алдаа хараад гацна.
 */
function detectFormat(buffer: Buffer): "xlsx" | "xls" | "other" {
  // .xlsx нь ZIP архив — «PK»
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) return "xlsx";

  // Хуучин .xls нь OLE2 compound file — D0 CF 11 E0 A1 B1 1A E1
  const ole2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (ole2.every((byte, index) => buffer[index] === byte)) return "xls";

  return "other";
}

export async function parseStatement(
  buffer: Buffer,
  churchAccount: string
): Promise<ParseStatementResult> {
  const format = detectFormat(buffer);

  if (format === "xls") {
    return {
      ok: false,
      error:
        "Энэ нь хуучин .xls хэлбэрийн файл байна. Excel дээр нээгээд «Файл → Хадгалах» дээрээс хэлбэрийг нь .xlsx болгож хадгалаад дахин оруулна уу.",
    };
  }

  if (format === "other") {
    return {
      ok: false,
      error:
        "Файл нь Excel (.xlsx) хэлбэртэй биш байна. Банкнаас .xlsx хэлбэрээр татаж авна уу.",
    };
  }

  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch (error) {
    console.error("Хуулга уншихад алдаа гарлаа:", error);
    return { ok: false, error: "Файлыг .xlsx болгон уншиж чадсангүй." };
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { ok: false, error: "Файлд хуудас алга." };

  // 1) Толгой мөрийг олно — хамгийн олон танил багана таарсан мөр
  let headerRow = 0;
  let mapping: Partial<Record<ColumnKey, number>> = {};
  let bestScore = 0;
  let lastHeaders: string[] = [];

  const scanTo = Math.min(worksheet.rowCount, HEADER_SCAN_ROWS);

  for (let index = 1; index <= scanTo; index += 1) {
    const row = worksheet.getRow(index);
    const found: Partial<Record<ColumnKey, number>> = {};
    const headers: string[] = [];

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = cellText(cell.value);
      if (!text) return;
      headers.push(text);

      const normalized = normalizeHeader(text);

      for (const [key, words] of Object.entries(COLUMN_SYNONYMS)) {
        const column = key as ColumnKey;
        if (found[column] !== undefined) continue;
        // Толгой нь «Харьцсан дансны дугаар (IBAN)» гэх мэт нэмэлттэй байж
        // болох тул агуулагдаж байвал таарсанд тооцно
        if (words.some((word) => normalized.includes(word))) {
          found[column] = colNumber;
        }
      }
    });

    const score = Object.keys(found).length;
    if (score > bestScore) {
      bestScore = score;
      headerRow = index;
      mapping = found;
      lastHeaders = headers;
    }
  }

  if (mapping.date === undefined) {
    return {
      ok: false,
      error: "Огнооны багана олдсонгүй.",
      headers: lastHeaders,
    };
  }

  const hasSplitAmount =
    mapping.income !== undefined || mapping.expense !== undefined;

  if (!hasSplitAmount && mapping.amount === undefined) {
    return {
      ok: false,
      error: "Дүнгийн багана олдсонгүй (орлого/зарлага эсвэл дүн).",
      headers: lastHeaders,
    };
  }

  // 2) Мөрүүдийг задална
  const rows: StatementRow[] = [];
  const seen = new Map<string, number>();
  let skipped = 0;

  const lastRow = Math.min(worksheet.rowCount, headerRow + MAX_ROWS);

  for (let index = headerRow + 1; index <= lastRow; index += 1) {
    const row = worksheet.getRow(index);
    const at = (key: ColumnKey) => {
      const column = mapping[key];
      return column === undefined ? null : row.getCell(column).value;
    };

    const date = readDate(at("date"));
    if (!date) {
      // Хуулгын төгсгөлд дүнгийн мөр, тайлбар ордог — огноогүй мөр гүйлгээ биш
      skipped += 1;
      continue;
    }

    let amount = 0;
    let type: "income" | "expense" = "income";

    if (hasSplitAmount) {
      const income = readAmount(at("income"));
      const expense = readAmount(at("expense"));

      if (income > 0) {
        amount = income;
        type = "income";
      } else if (expense > 0) {
        amount = expense;
        type = "expense";
      }
    } else {
      const value = readAmount(at("amount"));
      amount = Math.abs(value);
      type = value < 0 ? "expense" : "income";
    }

    if (amount === 0) {
      skipped += 1;
      continue;
    }

    const parsed = {
      date,
      memo: cellText(at("memo")),
      amount,
      type,
      donorAccount: cellText(at("donorAccount")),
      donorName: cellText(at("donorName")),
    };

    // Ижил гүйлгээ хэд дэх удаагаа таарч байгааг тоолно
    const fingerprint = [
      parsed.date,
      parsed.type,
      parsed.amount,
      parsed.donorAccount,
      normalizeMemo(parsed.memo),
    ].join("|");

    const seq = (seen.get(fingerprint) ?? 0) + 1;
    seen.set(fingerprint, seq);

    rows.push({
      rowNumber: index,
      ...parsed,
      importKey: buildImportKey(churchAccount, parsed, seq),
    });
  }

  if (rows.length === 0) {
    return {
      ok: false,
      error: "Гүйлгээний мөр олдсонгүй.",
      headers: lastHeaders,
    };
  }

  return { ok: true, rows, skipped };
}
