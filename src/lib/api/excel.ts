import "server-only";

import ExcelJS from "exceljs";

/** Нэг баганын тодорхойлолт */
export type SheetColumn<T> = {
  header: string;
  /** Мөр бүрээс харагдах утгыг гаргана */
  value: (row: T) => string | number | Date | null;
  /** Баганын өргөн, тэмдэгтээр — өгөхгүй бол толгойн уртаар тааруулна */
  width?: number;
  /** Тоон баганын форматыг Excel-д мэдэгдэнэ (жишээ нь мөнгө) */
  numberFormat?: string;
};

export type Sheet<T> = {
  /** Хуудасны нэр — Excel 31 тэмдэгтээр хязгаарладаг */
  name: string;
  columns: SheetColumn<T>[];
  rows: T[];
};

/** Excel хуудасны нэрэнд хориотой тэмдэгтүүд */
const ILLEGAL_SHEET_CHARS = /[*?:/\\[\]]/g;

const MAX_SHEET_NAME = 31;

/**
 * Хуудсуудаас .xlsx файлын агуулгыг үүсгэнэ.
 *
 * Толгой мөр нь хөлдөөгдсөн, шүүлтүүртэй — олон мөртэй бүртгэлийг Excel дээр
 * шууд шүүж, эрэмбэлж болно.
 */
export async function buildWorkbook(
  // Хуудас бүр өөр мөрийн төрөлтэй тул нэгтгэсэн жагсаалтад `any` зайлшгүй:
  // TypeScript-д гетероген массивыг төрөлтэй нь хадгалах цэвэр арга алга.
  sheets: Sheet<any>[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(
      sheet.name.replace(ILLEGAL_SHEET_CHARS, " ").slice(0, MAX_SHEET_NAME)
    );

    worksheet.columns = sheet.columns.map((column) => ({
      header: column.header,
      width: column.width ?? Math.max(12, column.header.length + 2),
      style: column.numberFormat
        ? { numFmt: column.numberFormat }
        : undefined,
    }));

    for (const row of sheet.rows) {
      worksheet.addRow(sheet.columns.map((column) => column.value(row)));
    }

    const header = worksheet.getRow(1);
    header.font = { bold: true };
    header.alignment = { vertical: "middle" };

    // Толгойг хөлдөөж, шүүлтүүр тавина — мөр олон байхад л ач холбогдолтой
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    if (sheet.rows.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.columns.length },
      };
    }
  }

  // exceljs нь ArrayBuffer буцаадаг — Node-ийн Buffer болгож хөрвүүлнэ
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}