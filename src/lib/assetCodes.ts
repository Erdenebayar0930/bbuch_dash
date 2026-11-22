/**
 * Эд хөрөнгийн кодчилол — угтвар + дугаар (AYG-001). Кодчилол таб ба
 * бүртгэх маягт хоёулаа эндээс дараагийн чөлөөтэй кодыг тооцно.
 */

/**
 * Кодын угтвар — Байршлын ангиллын эхний үсэг + Төрлийн 2 дахь үсэг + Нэрийн
 * үсэг + «-» (Т + Г + АТ → «ТГАТ-», код нь ТГАТ-001). Байршил ба Төрөл
 * заавал; Нэрийн үсэг байхгүй бол алгасна.
 */
export function codePrefix(locationLetter?: string, typeLetter?: string, nameLetter?: string): string {
  const first = (locationLetter ?? "").trim();
  const second = (typeLetter ?? "").trim();
  const third = (nameLetter ?? "").trim();
  return first && second ? `${first}${second}${third}-` : "";
}

/** Нэрийн эхний үсгүүд — «Аяга таваг» → «АТ» (үсэг санал болгоход) */
export function initials(name: string): string {
  return name
    .trim()
    .split(/[\s\-_/]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 8);
}

/** Угтвар оноосон ч код хараахан байхгүй үеийн оронгийн тоо (001) */
export const DEFAULT_CODE_DIGITS = 3;

/** Дугаараар төгсөх код — угтвар ба дугаар болгон задална */
export const CODE_RE = /^(.*?)(\d+)$/;

export const formatCode = (prefix: string, value: number, width: number) =>
  `${prefix}${String(value).padStart(width, "0")}`;

/** Тухайн угтвартай кодуудын дугаар ба хамгийн өргөн оронгийн тоо */
export function codeNumbers(prefix: string, codes: string[]): { numbers: number[]; width: number } {
  const numbers: number[] = [];
  let width = 0;
  for (const raw of codes) {
    const match = CODE_RE.exec(raw.trim());
    if (!match || match[1] !== prefix) continue;
    numbers.push(Number(match[2]));
    width = Math.max(width, match[2].length);
  }
  return { numbers, width: width || DEFAULT_CODE_DIGITS };
}

/** Дараагийн чөлөөтэй код — хамгийн их дугаар + 1 (алгассаныг нөхөхгүй) */
export function nextCode(prefix: string, codes: string[]): { code: string; number: number; width: number } {
  const { numbers, width } = codeNumbers(prefix, codes);
  const number = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return { code: formatCode(prefix, number, width), number, width };
}
