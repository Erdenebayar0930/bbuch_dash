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

/** «Илчлэл авсан» нэрийн дээд урт — баазын varchar(120)-тэй ижил */
export const MAX_REVELATION_SOURCE_LENGTH = 120;

/** «YYYY-MM-DD» мөн эсэх (бодит огноо) */
export const isIsoDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());

/** Өнөөдөр Улаанбаатарын цагаар, «YYYY-MM-DD» */
export const todayIso = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar" }).format(new Date());

/** «2026-11-16» → «2026 оны 11-р сарын 16» */
export function formatRevelationDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? `${y} оны ${m}-р сарын ${d}` : iso;
}
