/** «Илчлэл» нийтлэлийн хязгаарууд — сервер ба клиент хоёул эндээс уншина. */

/** Нэг нийтлэлд хавсаргах зургийн дээд тоо */
export const MAX_REVELATION_IMAGES = 10;

/** Нийтлэлийн бичвэрийн дээд урт */
export const MAX_REVELATION_LENGTH = 10_000;

/** Нэг зургийн дээд хэмжээ — storage.rules-тэй ижил байлгана */
export const MAX_REVELATION_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * «Илчлэл авсан» хүн — нийтлэлийн доор «… · Г.Мөнгөнцэцэгээс» гэж гарна.
 * Талбарыг хоосон орхивол энэ нэр орно (баазын DEFAULT ч мөн адил).
 */
export const DEFAULT_REVELATION_SOURCE = "Г.Мөнгөнцэцэг";

/** «Илчлэл авсан» нэрийн дээд урт — баазын varchar(120)-тэй ижил */
export const MAX_REVELATION_SOURCE_LENGTH = 120;

const SUFFIX_BY_VOWEL: Record<string, string> = {
  а: "аас",
  я: "аас",
  у: "аас",
  ю: "аас",
  ы: "аас",
  о: "оос",
  ё: "оос",
  э: "ээс",
  е: "ээс",
  ү: "ээс",
  ө: "өөс",
};
const VOWELS = "аэиоуөүяеёюы";

/**
 * Нэрийг гарах тийн ялгалд (-аас/-ээс/-оос/-өөс) оруулна:
 * «Г.Мөнгөнцэцэг» → «Г.Мөнгөнцэцэгээс», «Болормаа» → «Болормаагаас»,
 * «Тулга» → «Тулгаас». Эгшгийн зохицлыг сүүлийн (и-ээс бусад) эгшгээр нь
 * тогтооно; кирилл бус нэрт « -аас» гэж зүгээр залгана.
 */
export function ablative(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const lower = trimmed.toLowerCase();
  let suffix: string | undefined;
  for (let i = lower.length - 1; i >= 0 && !suffix; i--) {
    suffix = SUFFIX_BY_VOWEL[lower[i]];
  }
  if (!suffix) return /[а-яөү]/i.test(trimmed) ? `${trimmed}ээс` : `${trimmed}-аас`;

  const last = lower.at(-1) ?? "";
  const prev = lower.at(-2) ?? "";
  // Урт эгшиг, хос эгшиг, й-ээр төгссөн бол «г» жийрэглэнэ: Болормаа → Болормаагаас
  if (last === "й" || (VOWELS.includes(last) && VOWELS.includes(prev))) {
    return `${trimmed}г${suffix}`;
  }
  // Ганц богино эгшгээр төгссөн бол тэр эгшиг гээгдэнэ: Тулга → Тулгаас
  if (VOWELS.includes(last)) return `${trimmed.slice(0, -1)}${suffix}`;
  return `${trimmed}${suffix}`;
}
