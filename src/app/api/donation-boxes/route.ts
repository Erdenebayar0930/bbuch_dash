import { asc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireAdmin,
  requireAimag,
  serverError,
} from "@/lib/api/auth";
import { readDonationBox } from "@/lib/api/donationBoxInput";
import { db } from "@/lib/db";
import { donationBoxes } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Хандивын хайрцаг нь Туслах үйлчлэх аймгийн хариуцлага */
const AIMAG = "service";

/**
 * Хандивын хайрцгийн байршлууд — сүүлийн эргэлт ба нийт хураалттай хамт.
 *
 * Идэвхгүй болсныг ч буцаана — админ газрын зураг дээрээс дахин идэвхжүүлэх
 * боломжтой байх ёстой. Шүүхийг клиент тал хийнэ.
 */
export async function GET(request: NextRequest) {
  const result = await requireAimag(request, AIMAG);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select()
      .from(donationBoxes)
      .orderBy(asc(donationBoxes.createdAt));

    // Хайрцаг тус бүрийн ХАМГИЙН СҮҮЛИЙН эргэлт — DISTINCT ON нь Postgres дээр
    // хамгийн хямд арга, бүх түүхийг татаад шүүх шаардлагагүй.
    const latest = await db.execute<{
      box_id: string;
      status: string;
      amount: number;
      clothing_count: number;
      visited_at: string;
    }>(sql`
      select distinct on (box_id)
        box_id, status, amount, clothing_count, visited_at
      from donation_box_visits
      order by box_id, visited_at desc
    `);

    // Нийт хураалт — тайлангийн үндсэн тоо тул баазад бодуулна
    const totals = await db.execute<{
      box_id: string;
      total: number;
      clothing: number;
    }>(sql`
      select
        box_id,
        coalesce(sum(amount), 0)::int as total,
        coalesce(sum(clothing_count), 0)::int as clothing
      from donation_box_visits
      where status = 'collected'
      group by box_id
    `);

    const lastByBox = new Map(
      latest.rows.map((row) => [
        row.box_id,
        {
          status: row.status,
          amount: row.amount,
          clothingCount: row.clothing_count,
          visitedAt: row.visited_at,
        },
      ])
    );

    const totalByBox = new Map(
      totals.rows.map((row) => [
        row.box_id,
        { money: row.total, clothing: row.clothing },
      ])
    );

    return NextResponse.json({
      boxes: rows.map((row) => {
        const total = totalByBox.get(row.id);

        return {
          ...row,
          lastVisit: lastByBox.get(row.id) ?? null,
          totalCollected: total?.money ?? 0,
          totalClothing: total?.clothing ?? 0,
        };
      }),
    });
  } catch (error) {
    return serverError(error, "Хайрцгийн байршил уншихад алдаа гарлаа");
  }
}

/** Шинэ хайрцгийн байршил тэмдэглэнэ (зөвхөн админ). */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const parsed = readDonationBox(await request.json().catch(() => ({})), false);
    if (!parsed.ok) return badRequest(parsed.error);

    const [created] = await db
      .insert(donationBoxes)
      .values({
        ...parsed.value,
        name: parsed.value.name as string,
        lat: parsed.value.lat as number,
        lng: parsed.value.lng as number,
        createdBy: result.caller.uid,
      })
      .returning();

    return NextResponse.json({ box: created });
  } catch (error) {
    return serverError(error, "Байршил нэмэхэд алдаа гарлаа");
  }
}