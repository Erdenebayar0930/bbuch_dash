/**
 * «Сайн мэдээ» бүртгэлийн тогтсон утгууд — сервер ба клиент хоёул эндээс уншина.
 */

/**
 * «Сайн мэдээ» цэстэй аймгууд. Бүртгэл нь НЭГ л сан — бүгд ижил
 * жагсаалтыг харна, зөвхөн цэсний зам нь аймаг бүрийнх.
 */
export const gospelAimags = ["guard", "praise", "commission", "service"] as const;

export type GospelAimag = (typeof gospelAimags)[number];

export const isGospelAimag = (value: unknown): value is GospelAimag =>
  typeof value === "string" &&
  (gospelAimags as readonly string[]).includes(value);

/** Төрсөн оны доод хязгаар — дээд нь тухайн жил */
export const MIN_BIRTH_YEAR = 1900;

/** Бүртгэлийн зургийн дээд хэмжээ — storage.rules-тэй ижил байлгана */
export const MAX_GOSPEL_PHOTO_BYTES = 10 * 1024 * 1024;
