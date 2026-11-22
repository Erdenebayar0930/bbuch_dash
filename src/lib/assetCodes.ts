/**
 * Эд хөрөнгийн кодчилол — угтвар + дугаар (AYG-001). Кодчилол таб ба
 * бүртгэх маягт хоёулаа эндээс дараагийн чөлөөтэй кодыг тооцно.
 */

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
