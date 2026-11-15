import "server-only";

export type SupplyInput = {
  kind?: "money" | "item";
  title?: string;
  purpose?: string;
  amount?: number | null;
  quantity?: number;
  giver?: string;
  receivedOn?: string;
  note?: string;
};

type Parsed = { ok: true; value: SupplyInput } | { ok: false; error: string };

/** integer баганад багтах дээд дүн, ₮ */
const MAX_AMOUNT = 2_000_000_000;

const isDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());

/**
 * Хангамжийн бүртгэлийг шалгана. `partial` үед (засвар) ирсэн талбарыг л;
 * эс бөгөөс төрөл, юу, огноо заавал. Мөнгөнд дүн заавал.
 */
export function readSupply(body: unknown, partial: boolean): Parsed {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Өгөгдөл буруу байна." };
  }

  const input = body as Record<string, unknown>;
  const value: SupplyInput = {};

  if (input.kind !== undefined) {
    if (input.kind !== "money" && input.kind !== "item") {
      return { ok: false, error: "Төрөл буруу байна." };
    }
    value.kind = input.kind;
  }

  for (const [key, max, label] of [
    ["title", 255, "Нэр"],
    ["purpose", 255, "Зориулалт"],
    ["giver", 255, "Хэнээс"],
    ["note", 2000, "Тэмдэглэл"],
  ] as const) {
    const raw = input[key];
    if (raw === undefined) continue;
    if (typeof raw !== "string") return { ok: false, error: `${label} текст байх ёстой.` };
    const trimmed = raw.trim();
    if (trimmed.length > max) {
      return { ok: false, error: `${label} ${max} тэмдэгтээс урт байж болохгүй.` };
    }
    value[key] = trimmed;
  }

  if (input.amount !== undefined) {
    const amount = input.amount;
    if (amount === null) {
      value.amount = null;
    } else if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount < 0 ||
      amount > MAX_AMOUNT
    ) {
      return { ok: false, error: "Дүн 0-ээс их бүхэл тоо байна." };
    } else {
      value.amount = amount;
    }
  }

  if (input.quantity !== undefined) {
    const quantity = input.quantity;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 100_000) {
      return { ok: false, error: "Тоо ширхэг 1-ээс их бүхэл тоо байна." };
    }
    value.quantity = quantity;
  }

  if (input.receivedOn !== undefined) {
    if (typeof input.receivedOn !== "string" || !isDate(input.receivedOn)) {
      return { ok: false, error: "Огноо YYYY-MM-DD хэлбэртэй байна." };
    }
    value.receivedOn = input.receivedOn;
  }

  if (value.title !== undefined && !value.title) {
    return { ok: false, error: "Юу орж ирснийг бичнэ үү." };
  }

  if (!partial) {
    if (!value.kind) return { ok: false, error: "Төрлөө сонгоно уу." };
    if (!value.title) return { ok: false, error: "Юу орж ирснийг бичнэ үү." };
    if (!value.receivedOn) return { ok: false, error: "Огноогоо оруулна уу." };
    if (value.kind === "money" && !value.amount) {
      return { ok: false, error: "Мөнгөний дүнг оруулна уу." };
    }
  }

  // Мөнгөнд тоо ширхэг хамаарахгүй
  if (value.kind === "money") value.quantity = 1;

  return { ok: true, value };
}
