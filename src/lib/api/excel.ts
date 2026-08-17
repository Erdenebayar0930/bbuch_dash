import "server-only";

import ExcelJS from "exceljs";

import type { Writable } from "node:stream";

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

/**
 * Нэг багц хуудсыг ХОЙШЛУУЛЖ үүсгэгч.
 *
 * Функц хэлбэртэй байгаа нь санаатай: `writeWorkbook` нь багцуудыг НЭГ НЭГЭЭР
 * дуудаж, бичээд, тэр даруй суллана. Бүх багцыг урьдчилан бэлдвэл (жишээ нь
 * `Promise.all`) хамгийн их санах ойн хэрэглээ нь БҮХ багцын НИЙЛБЭР болно —
 * хойшлуулснаар хамгийн ТОМ ганц багцаар хязгаарлагдана.
 */
export type SheetSource = () => Promise<Sheet<any>[]>;

/** Excel хуудасны нэрэнд хориотой тэмдэгтүүд */
const ILLEGAL_SHEET_CHARS = /[*?:/\\[\]]/g;

const MAX_SHEET_NAME = 31;

/**
 * .xlsx файлыг УРСГАЛААР бичнэ.
 *
 * ЯАГААД УРСГАЛААР ВЭ: өмнө нь `workbook.xlsx.writeBuffer()` ашигладаг байсан
 * бөгөөд тэр нь (1) бүх нүдийг ExcelJS-ийн объект болгон санах ойд барьж,
 * (2) бэлэн файлыг дахин Buffer болгон хуулдаг. Хоёулаа мөрийн тоотой шууд
 * пропорциональ ургана. Passenger процессын санах ойн хязгаарт хүрвэл
 * процессыг устгах ба тэр агшинд БУСАД бүх хэрэглэгчийн хүсэлт хамт унана —
 * өөрөөр хэлбэл нэг админы татац бүх системийг унагаана.
 *
 * `WorkbookWriter` нь мөр бүрийг `commit()` хийх бүрд гаралт руу шахаж,
 * санах ойгоос гаргана. Ингэснээр санах ойн хэрэглээ мөрийн тооноос
 * ХАМААРАХГҮЙ болно.
 *
 * ⚠ Урсгал эхэлсэн хойно HTTP статусыг өөрчлөх боломжгүй. Тиймээс алдаа
 * гарвал урсгалыг таслана — клиент дутуу файл авна. Энэ нь эвдэрсэн файлыг
 * "амжилттай" гэж хүлээж авахаас дээр.
 */
export async function writeWorkbook(
  sources: SheetSource[],
  target: Writable
): Promise<void> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: target,
    useStyles: true,
  });

  workbook.created = new Date();

  for (const source of sources) {
    const sheets = await source();

    for (const sheet of sheets) {
      /**
       * `WorksheetWriter` дээр `views`, `autoFilter` нь ЗӨВХӨН УНШИХ шинж —
       * хуудсыг үүсгэх агшинд л өгч болно (энгийн `Worksheet` дээр шууд
       * оноодгоос ялгаатай). Шалтгаан нь урсгал: эдгээр нь XML-ийн эхэнд
       * бичигдэх ба мөр бичигдэж эхэлсэн хойно өөрчлөх боломжгүй.
       */
      const worksheet = workbook.addWorksheet(
        sheet.name.replace(ILLEGAL_SHEET_CHARS, " ").slice(0, MAX_SHEET_NAME),
        {
          // Толгойг хөлдөөнө — мөр олон байхад л ач холбогдолтой
          views: [{ state: "frozen", ySplit: 1 }],
          /**
           * `autoFilter`-ыг ExcelJS-ийн `WorksheetWriter` ажиллах үедээ
           * дэмждэг (lib/stream/xlsx/worksheet-writer.js) ч түүний
           * `AddWorksheetOptions` төрөлд бичигдээгүй — тиймээс cast хийв.
           */
          autoFilter:
            sheet.rows.length > 0
              ? {
                  from: { row: 1, column: 1 },
                  to: { row: 1, column: sheet.columns.length },
                }
              : undefined,
        } as Partial<ExcelJS.AddWorksheetOptions>
      );

      worksheet.columns = sheet.columns.map((column) => ({
        header: column.header,
        width: column.width ?? Math.max(12, column.header.length + 2),
        style: column.numberFormat
          ? { numFmt: column.numberFormat }
          : undefined,
      }));

      const header = worksheet.getRow(1);
      header.font = { bold: true };
      header.alignment = { vertical: "middle" };
      header.commit();

      for (const row of sheet.rows) {
        worksheet
          .addRow(sheet.columns.map((column) => column.value(row)))
          .commit();
      }

      /**
       * Хуудсыг хаамагц ExcelJS түүний нүднүүдийг суллана. Дараагийн багц
       * бэлдэхээс ӨМНӨ хийж байгаа нь чухал — эс бөгөөс хоёр багц зэрэг
       * санах ойд байх агшин үүснэ.
       */
      await worksheet.commit();
    }
  }

  await workbook.commit();
}
