import { asc, eq, sql } from "drizzle-orm";
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

    // Хайрцаг тус бүрийн ХАМГИЙН СҮҮЛИЙН эргэлт — бүх түүхийг татаад санах
    // ойд шүүхийн оронд баазад бодуулна.
    type LatestVisit = {
      box_id: string;
      status: string;
      amount: number;
      clothing_count: number;
      visited_at: Date;
    };

    type BoxTotal = { box_id: string; total: number; clothing: number };

    // Хайрцаг тус бүрийн сүүлийн эргэлт. Postgres дээр `distinct on (box_id)`
    // байсан — MySQL-д ийм бүтэц байхгүй тул цонхны функцээр дугаарлана.
    const [latest] = await db.execute(sql`
      select box_id, status, amount, clothing_count, visited_at
      from (
        select
          box_id, status, amount, clothing_count, visited_at,
          row_number() over (
            partition by box_id order by visited_at desc
          ) as rn
        from donation_box_visits
      ) ranked
      where rn = 1
    `);

    // Нийт хураалт — тайлангийн үндсэн тоо тул баазад бодуулна.
    // Postgres-ийн `::int` cast нь MySQL-д `cast(... as signed)`.
    const [totals] = await db.execute(sql`
      select
        box_id,
        cast(coalesce(sum(amount), 0) as signed) as total,
        cast(coalesce(sum(clothing_count), 0) as signed) as clothing
      from donation_box_visits
      where status = 'collected'
      group by box_id
    `);

    const lastByBox = new Map(
      (latest as unknown as LatestVisit[]).map((row) => [
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
      (totals as unknown as BoxTotal[]).map((row) => [
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

    // MySQL нь INSERT ... RETURNING дэмждэггүй — ID-г урьдчилж үүсгэнэ
    const id = crypto.randomUUID();

    await db.insert(donationBoxes).values({
      ...parsed.value,
      id,
      name: parsed.value.name as string,
      lat: parsed.value.lat as number,
      lng: parsed.value.lng as number,
      createdBy: result.caller.uid,
    });

    const [created] = await db
      .select()
      .from(donationBoxes)
      .where(eq(donationBoxes.id, id));

    return NextResponse.json({ box: created });
  } catch (error) {
    return serverError(error, "Байршил нэмэхэд алдаа гарлаа");
  }
}