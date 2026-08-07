import { and, asc, eq, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";

import { isScheduleKind, scheduleConfigs } from "@/data/scheduleOptions";
import {
  badRequest,
  requireActiveUser,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import { notifyUsers } from "@/lib/api/notify";
import { assigneeJoin, shiftColumns } from "@/lib/api/schedule";
import { readScheduleShift } from "@/lib/api/scheduleInput";
import { db } from "@/lib/db";
import { scheduleShifts, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * Ээлжийн хуваарь — огноогоор өсөхөөр.
 *
 * `?kind=watering|dulaankhaan` заавал: хоёр хуваарь нэг хүснэгтэд сууна.
 * `?from=YYYY-MM-DD&to=YYYY-MM-DD` — хугацааны хязгаар. Огноо нь текст боловч
 * ISO хэлбэр лексикографаар зөв эрэмбэлэгддэг тул шууд харьцуулж болно.
 * Уншихыг бүх идэвхтэй хэрэглэгчид нээлттэй — хуваарь бол нийтийн мэдээлэл.
 */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!isScheduleKind(kind)) return badRequest("Хуваарийн төрөл буруу байна.");

  if ((from && !isDate(from)) || (to && !isDate(to))) {
    return badRequest("Огноог YYYY-MM-DD хэлбэрээр оруулна уу.");
  }

  try {
    const filters = [
      eq(scheduleShifts.kind, kind),
      from ? gte(scheduleShifts.date, from) : undefined,
      to ? lte(scheduleShifts.date, to) : undefined,
    ].filter(Boolean);

    const rows = await db
      .select(shiftColumns)
      .from(scheduleShifts)
      .leftJoin(users, assigneeJoin)
      .where(and(...filters))
      .orderBy(asc(scheduleShifts.date), asc(scheduleShifts.createdAt));

    return NextResponse.json({ shifts: rows });
  } catch (error) {
    return serverError(error, "Хуваарь уншихад алдаа гарлаа");
  }
}

/** Шинэ ээлж нэмнэ (зөвхөн админ). */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!isScheduleKind(body.kind)) {
      return badRequest("Хуваарийн төрөл буруу байна.");
    }

    const parsed = await readScheduleShift(body, false);
    if (!parsed.ok) return badRequest(parsed.error);

    const [created] = await db
      .insert(scheduleShifts)
      .values({
        ...parsed.value,
        kind: body.kind,
        date: parsed.value.date as string,
        createdBy: result.caller.uid,
      })
      .returning({ id: scheduleShifts.id });

    const [row] = await db
      .select(shiftColumns)
      .from(scheduleShifts)
      .leftJoin(users, assigneeJoin)
      .where(eq(scheduleShifts.id, created.id))
      .limit(1);

    // Хариуцагчид шууд мэдэгдэнэ — өөрөө өөрийгөө оновол шаардлагагүй
    if (row.assignedTo && row.assignedTo !== result.caller.uid) {
      const config = scheduleConfigs[body.kind];

      await notifyUsers(
        [row.assignedTo],
        {
          title: `${config.label} — шинэ ээлж`,
          body: `${row.date}${row.area ? ` · ${row.area}` : ""}`,
          url: config.path,
        },
        result.caller.uid
      );
    }

    return NextResponse.json({ shift: row });
  } catch (error) {
    return serverError(error, "Ээлж нэмэхэд алдаа гарлаа");
  }
}