/** «Илчлэл» нийтлэлийн хязгаарууд — сервер ба клиент хоёул эндээс уншина. */

/** Нэг нийтлэлд хавсаргах зургийн дээд тоо */
export const MAX_REVELATION_IMAGES = 10;

/** Нийтлэлийн бичвэрийн дээд урт */
export const MAX_REVELATION_LENGTH = 10_000;

/** Нэг зургийн дээд хэмжээ — storage.rules-тэй ижил байлгана */
export const MAX_REVELATION_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * «Илчлэл авсан» хүн — нийтлэлийн доор «… · Г.Мөнгөнцэцэг» гэж гарна.
 * Талбарыг хоосон орхивол энэ нэр орно (баазын DEFAULT ч мөн адил).
 */
export const DEFAULT_REVELATION_SOURCE = "Г.Мөнгөнцэцэг";

/**
 * Илчлэлийн загвартай бүртгэлийн төрөл — нэг хүснэгт, `kind` баганаар ялгагдана.
 *   revelation       — аймгийн «Илчлэл» цэс
 *   general-command  — «Тушаал» → Ерөнхий тушаалууд
 *   named-command    — «Тушаал» → Нэр цохож хэлсэн тушаал
 */
export const REVELATION_KINDS = {
  revelation: { title: "Илчлэл", placeholder: "Илчлэлээ бичнэ үү...", source: "Илчлэл авсан" },
  "general-command": { title: "Ерөнхий тушаал", placeholder: "Тушаалаа бичнэ үү...", source: "Тушаал авсан" },
  "named-command": {
    title: "Нэр цохож хэлсэн тушаал",
    placeholder: "Хэнд ямар тушаал хэлснийг бичнэ үү...",
    source: "Тушаал авсан",
  },
} as const;

export type RevelationKind = keyof typeof REVELATION_KINDS;

export const isRevelationKind = (value: unknown): value is RevelationKind =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(REVELATION_KINDS, value);

/** «Илчлэл авсан» нэрийн дээд урт — баазын varchar(120)-тэй ижил */
export const MAX_REVELATION_SOURCE_LENGTH = 120;

/** «YYYY-MM-DD» мөн эсэх (бодит огноо) */
export const isIsoDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());

/** Өнөөдөр Улаанбаатарын цагаар, «YYYY-MM-DD» */
export const todayIso = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar" }).format(new Date());

/** «2026-11-16» хэвээр — огнооны нэг формат (@see lib/dateFormat.ts) */
export function formatRevelationDate(iso: string): string {
  return iso;
}
