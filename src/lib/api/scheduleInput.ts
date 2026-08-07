import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const MAX_TEXT = 200;

/** YYYY-MM-DD — цагийн бүсээс хамаарахгүй хэлбэр */
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export type SchedulePatch = {
  date?: string;
  assignedTo?: string | null;
  area?: string;
  note?: string;
};

export type ParsedSchedule =
  | { ok: true; value: SchedulePatch }
  | { ok: false; error: string };

const invalid = (error: string): ParsedSchedule => ({ ok: false, error });

/**
 * Ээлжийн өгөгдлийг шалгана.
 *
 * `partial: true` үед зөвхөн ирсэн талбарыг шалгана — үүсгэх (огноо заавал)
 * ба засах (хэсэгчилсэн) хоёрт хоёуланд нь ашиглагдана. `kind` нь энд орохгүй:
 * түүнийг зам эсвэл байгаа мөрөөс тодорхойлно, клиент дур мэдэн солихгүй.
 */
export async function readScheduleShift(
  body: unknown,
  partial: boolean
): Promise<ParsedSchedule> {
  if (typeof body !== "object" || body === null) {
    return invalid("Өгөгдөл буруу байна.");
  }

  const input = body as Record<string, unknown>;
  const patch: SchedulePatch = {};

  if (input.date !== undefined || !partial) {
    const date = typeof input.date === "string" ? input.date.trim() : "";
    if (!isDate(date)) return invalid("Огноог YYYY-MM-DD хэлбэрээр оруулна уу.");
    patch.date = date;
  }

  for (const key of ["area", "note"] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== "string") {
      return invalid("Ажил ба тэмдэглэл текст байх ёстой.");
    }

    const value = (input[key] as string).trim();
    if (value.length > MAX_TEXT) {
      return invalid(`Утга ${MAX_TEXT} тэмдэгтээс урт байж болохгүй.`);
    }
    patch[key] = value;
  }

  // Хариуцагч байгаа эсэхийг шалгана — байхгүй бол FK алдаа өгнө
  if (input.assignedTo !== undefined) {
    const value = input.assignedTo;

    if (value === null || value === "") {
      patch.assignedTo = null;
    } else if (typeof value !== "string") {
      return invalid("Хариуцагч буруу байна.");
    } else {
      const [found] = await db
        .select({ uid: users.uid })
        .from(users)
        .where(eq(users.uid, value))
        .limit(1);

      if (!found) return invalid("Хариуцагч олдсонгүй.");
      patch.assignedTo = value;
    }
  }

  return { ok: true, value: patch };
}