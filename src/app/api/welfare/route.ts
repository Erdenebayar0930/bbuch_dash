import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireAdmin,
  requireAimag,
  serverError,
} from "@/lib/api/auth";
import { readWelfareHousehold } from "@/lib/api/welfareInput";
import { db } from "@/lib/db";
import { welfareHouseholds } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Халамжийн үйлчлэл нь Тахилтын хариуцлага */
const AIMAG = "tahilt";

/**
 * Халамжийн үйлчлэлд хамрагдах өрхүүд — сүүлийн тусламж ба нийт дүнтэй хамт.
 *
 * Идэвхгүй болсныг ч буцаана — админ дахин идэвхжүүлэх боломжтой байх ёстой.
 */
export async function GET(request: NextRequest) {
  const result = await requireAimag(request, AIMAG);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select()
      .from(welfareHouseholds)
      .orderBy(asc(welfareHouseholds.createdAt));

    // Өрх тус бүрийн ХАМГИЙН СҮҮЛИЙН тусламж — бүх түүхийг татаад санах ойд
    // шүүхийн оронд баазад бодуулна.
    type LatestAid = {
      household_id: string;
      description: string;
      amount: number;
      provided_at: Date;
    };

    type HouseholdTotal = {
      household_id: string;
      total: number;
      times: number;
    };

    // Postgres дээр `distinct on (household_id)` байсан — MySQL-д ийм бүтэц
    // байхгүй тул цонхны функцээр мөр бүрийг дугаарлаад эхнийхийг нь авна.
    const [latest] = await db.execute(sql`
      select household_id, description, amount, provided_at
      from (
        select
          household_id, description, amount, provided_at,
          row_number() over (
            partition by household_id order by provided_at desc
          ) as rn
        from welfare_aids
      ) ranked
      where rn = 1
    `);

    // Нийт зарцуулалт ба тусламжийн тоо — тайлангийн үндсэн тоо тул баазад.
    // Postgres-ийн `::int` cast нь MySQL-д `cast(... as signed)`.
    const [totals] = await db.execute(sql`
      select
        household_id,
        cast(coalesce(sum(amount), 0) as signed) as total,
        cast(count(*) as signed) as times
      from welfare_aids
      group by household_id
    `);

    const lastByHousehold = new Map(
      (latest as unknown as LatestAid[]).map((row) => [
        row.household_id,
        {
          description: row.description,
          amount: row.amount,
          providedAt: row.provided_at,
        },
      ])
    );

    const totalByHousehold = new Map(
      (totals as unknown as HouseholdTotal[]).map((row) => [
        row.household_id,
        { total: row.total, times: row.times },
      ])
    );

    return NextResponse.json({
      households: rows.map((row) => {
        const total = totalByHousehold.get(row.id);

        return {
          ...row,
          lastAid: lastByHousehold.get(row.id) ?? null,
          totalAmount: total?.total ?? 0,
          aidCount: total?.times ?? 0,
        };
      }),
    });
  } catch (error) {
    return serverError(error, "Халамжийн бүртгэл уншихад алдаа гарлаа");
  }
}

/** Шинэ өрх бүртгэнэ (зөвхөн админ). */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const parsed = readWelfareHousehold(
      await request.json().catch(() => ({})),
      false
    );
    if (!parsed.ok) return badRequest(parsed.error);

    // MySQL нь INSERT ... RETURNING дэмждэггүй — ID-г урьдчилж үүсгэнэ
    const id = crypto.randomUUID();

    await db.insert(welfareHouseholds).values({
      ...parsed.value,
      id,
      name: parsed.value.name as string,
      lat: parsed.value.lat as number,
      lng: parsed.value.lng as number,
      createdBy: result.caller.uid,
    });

    const [created] = await db
      .select()
      .from(welfareHouseholds)
      .where(eq(welfareHouseholds.id, id));

    return NextResponse.json({ household: created });
  } catch (error) {
    return serverError(error, "Өрх бүртгэхэд алдаа гарлаа");
  }
}