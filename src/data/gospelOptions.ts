/**
 * «Сайн мэдээ» бүртгэлийн тогтсон утгууд — сервер ба клиент хоёул эндээс уншина.
 */

/**
 * «Сайн мэдээ» цэстэй аймгууд. Бүртгэл нь НЭГ л сан — гурвуулаа ижил
 * жагсаалтыг харна, зөвхөн цэсний зам нь аймаг бүрийнх.
 */
export const gospelAimags = ["guard", "praise", "commission"] as const;

export type GospelAimag = (typeof gospelAimags)[number];

export const isGospelAimag = (value: unknown): value is GospelAimag =>
  typeof value === "string" &&
  (gospelAimags as readonly string[]).includes(value);

/** Сайн мэдээ сонссон хүний хариу */
export const gospelResponses = ["accepted", "interested", "declined"] as const;

export type GospelResponse = (typeof gospelResponses)[number];

export const gospelResponseLabels: Record<GospelResponse, string> = {
  accepted: "Хүлээн авсан",
  interested: "Сонирхсон",
  declined: "Татгалзсан",
};

export const isGospelResponse = (value: unknown): value is GospelResponse =>
  typeof value === "string" &&
  (gospelResponses as readonly string[]).includes(value);
