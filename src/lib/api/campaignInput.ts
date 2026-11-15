import "server-only";

/** Хандивын төрөл */
export const CAMPAIGN_KINDS = ["target", "monthly", "once"] as const;

export type CampaignInput = {
  title?: string;
  kind?: (typeof CAMPAIGN_KINDS)[number];
  purpose?: string;
  targetAmount?: number | null;
  memoPrefix?: string;
  endsOn?: string;
  active?: boolean;
};

type Parsed = { ok: true; value: CampaignInput } | { ok: false; error: string };

/** Зорилтот дүнгийн дээд хязгаар, ₮ — integer баганад багтах */
const MAX_TARGET = 2_000_000_000;

const isDateOrEmpty = (value: string) =>
  value === "" ||
  (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()));

/**
 * Хандивын аяны маягтыг шалгана. `partial` үед (засвар) ирсэн талбарыг л;
 * эс бөгөөс зорилго заавал. Данс нь бүх хандивт нэг (`CAMPAIGN_ACCOUNT`).
 */
export function readCampaign(body: unknown, partial: boolean): Parsed {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Өгөгдөл буруу байна." };
  }

  const input = body as Record<string, unknown>;
  const value: CampaignInput = {};

  const text = (key: keyof CampaignInput, max: number, label: string): string | null => {
    const raw = input[key];
    if (raw === undefined) return null;
    if (typeof raw !== "string") return `${label} текст байх ёстой.`;
    const trimmed = raw.trim();
    if (trimmed.length > max) return `${label} ${max} тэмдэгтээс урт байж болохгүй.`;
    (value as Record<string, unknown>)[key] = trimmed;
    return null;
  };

  for (const [key, max, label] of [
    ["title", 255, "Хандивын зорилго"],
    ["purpose", 5000, "Тайлбар"],
    ["memoPrefix", 64, "Гүйлгээний утга"],
  ] as const) {
    const error = text(key, max, label);
    if (error) return { ok: false, error };
  }

  if (input.kind !== undefined) {
    if (!(CAMPAIGN_KINDS as readonly unknown[]).includes(input.kind)) {
      return { ok: false, error: "Хандивын төрөл буруу байна." };
    }
    value.kind = input.kind as CampaignInput["kind"];
  }

  if (input.targetAmount !== undefined) {
    const amount = input.targetAmount;
    if (amount === null || amount === 0) {
      value.targetAmount = null;
    } else if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount < 0 ||
      amount > MAX_TARGET
    ) {
      return { ok: false, error: "Зорилтот дүн 0-ээс их бүхэл тоо байна." };
    } else {
      value.targetAmount = amount;
    }
  }

  if (input.endsOn !== undefined) {
    if (typeof input.endsOn !== "string" || !isDateOrEmpty(input.endsOn)) {
      return { ok: false, error: "Дуусах огноо YYYY-MM-DD хэлбэртэй байна." };
    }
    value.endsOn = input.endsOn;
  }

  if (input.active !== undefined) {
    if (typeof input.active !== "boolean") {
      return { ok: false, error: "active нь true/false байна." };
    }
    value.active = input.active;
  }

  if (value.title !== undefined && !value.title) {
    return { ok: false, error: "Хандивын зорилгоо оруулна уу." };
  }

  if (!partial && !value.title) {
    return { ok: false, error: "Хандивын зорилгоо оруулна уу." };
  }

  return { ok: true, value };
}
