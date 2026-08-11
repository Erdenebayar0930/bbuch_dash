/** 1/10 ба өргөлийг гүйлгээний утгаар нь ялгах дүрэм */

/** Гүйлгээний ангилал — `transactions.category`-д ийм утгаар бичигдэнэ */
export const TITHE = "1/10";
export const OFFERING = "Өргөл";

export type DonationKind = typeof TITHE | typeof OFFERING;

export const donationKinds: DonationKind[] = [TITHE, OFFERING];

/**
 * «1/10» гэж таних анхны загварууд.
 *
 * Хүн бүр өөрөөр бичдэг тул аль болох олон хувилбарыг хамруулав. Админ
 * `/statement` хуудсанд нэмж, хасаж чадна — энэ жагсаалт нь зөвхөн хоосон
 * бааз дээр нэг удаа суух эхлэл.
 */
export const defaultTithePatterns = [
  "1/10",
  "1\\10",
  "1-10",
  "110",
  "10%",
  "10 хувь",
  "аравны нэг",
  "аравны1",
  "арван хувь",
  "aravnii neg",
  "aravni neg",
  "1/10 hurgev",
  "tithe",
  "tithing",
];

/**
 * Харьцуулахын өмнө текстийг цэгцлэнэ.
 *
 * Зай, цэг, таслал, зураас зэргийг хасч, жижиг үсэг болгоно: «1 / 10»,
 * «1/10.», «1-10» гурвуулаа «110» болж таарна. Кирилл «ө/ү» зэргийг хөндөхгүй.
 */
export function normalizeMemo(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s./\\,;:_|"'`~!?()[\]{}<>+*=-]/g, "");
}

/**
 * Гүйлгээний утга 1/10 мөн эсэх.
 *
 * Загварын аль нэг нь утганд агуулагдвал 1/10, эс бөгөөс өргөл. Хоосон
 * загварыг алгасна — эс бөгөөс бүх мөр 1/10 болно.
 */
export function classifyMemo(
  memo: string,
  patterns: string[]
): DonationKind {
  const haystack = normalizeMemo(memo);
  if (!haystack) return OFFERING;

  for (const pattern of patterns) {
    const needle = normalizeMemo(pattern);
    if (needle && haystack.includes(needle)) return TITHE;
  }

  return OFFERING;
}
