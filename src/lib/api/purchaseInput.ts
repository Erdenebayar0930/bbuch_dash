import "server-only";

import { eq } from "drizzle-orm";

import { isPurchaseStatus, type PurchaseStatus } from "@/data/supplyOptions";
import { isTaskPriority, type TaskPriority } from "@/data/taskOptions";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const MAX_NAME = 160;
const MAX_NOTE = 400;
const MAX_QUANTITY = 1_000_000;
/** Нэгж үнийн дээд хязгаар, ₮ — андуурч тэг илүү бичихээс хамгаална */
const MAX_PRICE = 1_000_000_000;

export type PurchasePatch = {
  name?: string;
  quantity?: number;
  unit?: string;
  estimatedPrice?: number;
  priority?: TaskPriority;
  status?: PurchaseStatus;
  note?: string;
  requestedBy?: string | null;
};

export type ParsedPurchase =
  | { ok: true; value: PurchasePatch }
  | { ok: false; error: string };

const invalid = (error: string): ParsedPurchase => ({ ok: false, error });

/**
 * Худалдан авах хүсэлтийн өгөгдлийг шалгана.
 *
 * `partial: true` үед зөвхөн ирсэн талбарыг шалгана — үүсгэх (нэр заавал)
 * ба засах (хэсэгчилсэн) хоёрт хоёуланд нь ашиглагдана.
 */
export async function readPurchase(
  body: unknown,
  partial: boolean
): Promise<ParsedPurchase> {
  if (typeof body !== "object" || body === null) {
    return invalid("Өгөгдөл буруу байна.");
  }

  const input = body as Record<string, unknown>;
  const patch: PurchasePatch = {};

  if (input.name !== undefined || !partial) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) return invalid("Барааны нэрийг оруулна уу.");
    if (name.length > MAX_NAME) {
      return invalid(`Нэр ${MAX_NAME} тэмдэгтээс урт байж болохгүй.`);
    }
    patch.name = name;
  }

  if (input.unit !== undefined) {
    if (typeof input.unit !== "string") return invalid("Нэгж текст байх ёстой.");
    patch.unit = input.unit.trim();
  }

  if (input.note !== undefined) {
    if (typeof input.note !== "string") {
      return invalid("Тэмдэглэл текст байх ёстой.");
    }
    const note = input.note.trim();
    if (note.length > MAX_NOTE) {
      return invalid(`Тэмдэглэл ${MAX_NOTE} тэмдэгтээс урт байж болохгүй.`);
    }
    patch.note = note;
  }

  for (const [key, max, message] of [
    ["quantity", MAX_QUANTITY, "Тоо хэмжээ 0-ээс их бүхэл тоо байна."],
    ["estimatedPrice", MAX_PRICE, "Үнэ 0-ээс их бүхэл тоо байна."],
  ] as const) {
    if (input[key] === undefined) continue;

    const value = input[key];
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > max
    ) {
      return invalid(message);
    }
    patch[key] = value;
  }

  if (input.priority !== undefined) {
    if (!isTaskPriority(input.priority)) {
      return invalid("Ач холбогдол буруу байна.");
    }
    patch.priority = input.priority;
  }

  if (input.status !== undefined) {
    if (!isPurchaseStatus(input.status)) return invalid("Төлөв буруу байна.");
    patch.status = input.status;
  }

  // Хүсэлт гаргагч байгаа эсэхийг шалгана — байхгүй бол FK алдаа өгнө
  if (input.requestedBy !== undefined) {
    const value = input.requestedBy;

    if (value === null || value === "") {
      patch.requestedBy = null;
    } else if (typeof value !== "string") {
      return invalid("Хүсэлт гаргагч буруу байна.");
    } else {
      const [found] = await db
        .select({ uid: users.uid })
        .from(users)
        .where(eq(users.uid, value))
        .limit(1);

      if (!found) return invalid("Хүсэлт гаргагч олдсонгүй.");
      patch.requestedBy = value;
    }
  }

  return { ok: true, value: patch };
}