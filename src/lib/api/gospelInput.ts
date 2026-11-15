import "server-only";

import { isGospelAimag, isGospelResponse } from "@/data/gospelOptions";
import { genders, isValidOption } from "@/data/profileOptions";
import { gospelContacts, users } from "@/lib/db/schema";

export type GospelInput = {
  name?: string;
  phone?: string;
  gender?: string;
  age?: number;
  address?: string;
  sharedOn?: string;
  response?: string;
  note?: string;
  aimag?: string;
};

type Parsed = { ok: true; value: GospelInput } | { ok: false; error: string };

const isDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
};

/** Текст талбар ба түүний дээд урт */
const TEXT_LIMITS = { name: 255, phone: 32, address: 255, note: 2000 } as const;

/**
 * Хүсэлтийн биеийг шалгаж, зөвхөн зөв талбаруудыг буцаана.
 *
 * `partial` үед (засвар) ирээгүй талбарыг алгасна; эс бөгөөс нэр, огноо,
 * аймаг заавал байна.
 */
export function readGospelContact(body: unknown, partial: boolean): Parsed {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Хүсэлтийн бие буруу байна." };
  }

  const input = body as Record<string, unknown>;
  const value: GospelInput = {};

  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    const raw = input[key];
    if (raw === undefined) continue;
    if (typeof raw !== "string") return { ok: false, error: `${key} нь текст байна.` };

    const trimmed = raw.trim();
    if (trimmed.length > limit) {
      return { ok: false, error: `${key} ${limit} тэмдэгтээс урт байж болохгүй.` };
    }
    value[key as keyof typeof TEXT_LIMITS] = trimmed;
  }

  if (value.name !== undefined && value.name === "") {
    return { ok: false, error: "Нэрээ оруулна уу." };
  }

  if (input.gender !== undefined) {
    if (
      typeof input.gender !== "string" ||
      (input.gender !== "" && !isValidOption(genders, input.gender))
    ) {
      return { ok: false, error: "Хүйс буруу байна." };
    }
    value.gender = input.gender;
  }

  if (input.age !== undefined) {
    const age = input.age;
    if (typeof age !== "number" || !Number.isInteger(age) || age < 0 || age > 120) {
      return { ok: false, error: "Нас 0-120 хооронд бүхэл тоо байна." };
    }
    value.age = age;
  }

  if (input.sharedOn !== undefined) {
    if (typeof input.sharedOn !== "string" || !isDate(input.sharedOn)) {
      return { ok: false, error: "Огноо YYYY-MM-DD хэлбэртэй байна." };
    }
    value.sharedOn = input.sharedOn;
  }

  if (input.response !== undefined) {
    if (!isGospelResponse(input.response)) {
      return { ok: false, error: "Хариу буруу байна." };
    }
    value.response = input.response;
  }

  if (input.aimag !== undefined) {
    if (!isGospelAimag(input.aimag)) return { ok: false, error: "Аймаг буруу байна." };
    value.aimag = input.aimag;
  }

  if (!partial) {
    if (!value.name) return { ok: false, error: "Нэрээ оруулна уу." };
    if (!value.sharedOn) return { ok: false, error: "Огноогоо оруулна уу." };
    if (!value.aimag) return { ok: false, error: "Аймгаа заана уу." };
  }

  return { ok: true, value };
}

/** Хүргэсэн гишүүний нэртэй хамт уншина — жагсаалт ба засварын хариунд */
export const gospelSelection = {
  id: gospelContacts.id,
  name: gospelContacts.name,
  phone: gospelContacts.phone,
  gender: gospelContacts.gender,
  age: gospelContacts.age,
  address: gospelContacts.address,
  sharedOn: gospelContacts.sharedOn,
  response: gospelContacts.response,
  note: gospelContacts.note,
  aimag: gospelContacts.aimag,
  sharedBy: gospelContacts.sharedBy,
  sharedByFirstName: users.firstName,
  sharedByLastName: users.lastName,
  createdAt: gospelContacts.createdAt,
};
