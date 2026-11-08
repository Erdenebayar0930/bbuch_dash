import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { GUARD_AIMAG } from "@/data/guardOptions";
import {
  badRequest,
  requireAdmin,
  requireAimag,
  serverError,
} from "@/lib/api/auth";
import { readDonationBox } from "@/lib/api/donationBoxInput";
import { db } from "@/lib/db";
import { guardPoints } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAME_REQUIRED = "Цэгийн нэрийг оруулна уу.";

/**
 * Харуулын цэгүүд — сүүлийн эргэлтийн хамт.
 *
 * Идэвхгүй болсныг ч буцаана — админ газрын зураг дээрээс дахин идэвхжүүлэх
 * боломжтой байх ёстой.
 */
export async function GET(request: NextRequest) {
  const result = await requireAimag(request, GUARD_AIMAG);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select()
      .from(guardPoints)
      .orderBy(asc(guardPoints.createdAt));

    type LatestVisit = { point_id: string; status: string; visited_at: Date };

    // Цэг тус бүрийн ХАМГИЙН СҮҮЛИЙН эргэлт — баазад бодуулна
    const { rows: latest } = await db.execute(sql`
      select distinct on (point_id) point_id, status, visited_at
      from guard_point_visits
      order by point_id, visited_at desc
    `);

    const lastByPoint = new Map(
      (latest as unknown as LatestVisit[]).map((row) => [
        row.point_id,
        { status: row.status, visitedAt: row.visited_at },
      ])
    );

    return NextResponse.json({
      points: rows.map((row) => ({
        ...row,
        lastVisit: lastByPoint.get(row.id) ?? null,
      })),
    });
  } catch (error) {
    return serverError(error, "Харуулын цэгүүдийг уншихад алдаа гарлаа");
  }
}

/** Шинэ харуулын цэг тэмдэглэнэ (зөвхөн админ). */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const parsed = readDonationBox(
      await request.json().catch(() => ({})),
      false,
      NAME_REQUIRED
    );
    if (!parsed.ok) return badRequest(parsed.error);

    const id = crypto.randomUUID();

    await db.insert(guardPoints).values({
      ...parsed.value,
      id,
      name: parsed.value.name as string,
      lat: parsed.value.lat as number,
      lng: parsed.value.lng as number,
      createdBy: result.caller.uid,
    });

    const [created] = await db
      .select()
      .from(guardPoints)
      .where(eq(guardPoints.id, id));

    return NextResponse.json({ point: created });
  } catch (error) {
    return serverError(error, "Цэг нэмэхэд алдаа гарлаа");
  }
}
