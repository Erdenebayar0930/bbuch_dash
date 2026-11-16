/**
 * Огнооны НЭГ формат — бүх дэлгэцэд: `2026-11-02`, цагтай бол `2026-11-02 14:05`.
 *
 * Монголд огноог ингэж бичдэг (ISO хэлбэр). `Intl.DateTimeFormat("mn-MN")` нь
 * хөтөч бүрт өөр («2026 оны 11-р сарын 2», «2026.11.02» г.м.) гардаг тул
 * түүнийг ашиглахгүй — энд л тодорхойлно.
 *
 * Хөтчийн орон нутгийн цагаар (өмнөх Intl форматлагчтай ижил): хэрэглэгчид
 * Монголд байгаа бөгөөд `new Date(y, m, d)`-ээр үүсгэсэн огноо нэг өдрөөр
 * гулсахгүй. Обьект бүр `Intl.DateTimeFormat` шиг `.format()`-тэй тул өмнөх
 * кодыг өөрчлөхгүйгээр сольж болно.
 */

type DateInput = Date | number | string;

const pad = (value: number) => String(value).padStart(2, "0");

const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));

/** `2026-11-02` */
export function formatDate(value: DateInput): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `2026-11-02 14:05` */
export function formatDateTime(value: DateInput): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `11-02` — он нь ойлгомжтой газар (долоо хоногийн хуваарь г.м.) */
export function formatMonthDay(value: DateInput): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `2026-11` */
export function formatYearMonth(value: DateInput): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** `2026-11` — он, сарын тоогоор */
export const yearMonth = (year: number, month: number) => `${year}-${pad(month)}`;

/** `Intl.DateTimeFormat`-ын оронд шууд тавих форматлагчид */
export const dateFormat = { format: formatDate };
export const dateTimeFormat = { format: formatDateTime };
export const monthDayFormat = { format: formatMonthDay };
export const yearMonthFormat = { format: formatYearMonth };
