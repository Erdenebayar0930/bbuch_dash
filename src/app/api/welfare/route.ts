import { asc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireActiveUser,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import { readWelfareHousehold } from "@/lib/api/welfareInput";
import { db } from "@/lib/db";
import { welfareHouseholds } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Халамжийн үйлчлэлд хамрагдах өрхүүд — сүүлийн тусламж ба нийт дүнтэй хамт.
 *
 * Идэвхгүй болсныг ч буцаана — админ дахин идэвхжүүлэх боломжтой байх ёстой.
 */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select()
      .from(welfareHouseholds)
      .orderBy(asc(welfareHouseholds.createdAt));

    // Өрх тус бүрийн ХАМГИЙН СҮҮЛИЙН тусламж — DISTINCT ON нь Postgres дээр
    // хамгийн хямд арга, бүх түүхийг татаад шүүх шаардлагагүй.
    const latest = await db.execute<{
      household_id: string;
      description: string;
      amount: number;
      provided_at: string;
    }>(sql`
      select distinct on (household_id)
        household_id, description, amount, provided_at
      from welfare_aids
      order by household_id, provided_at desc
    `);

    // Нийт зарцуулалт ба тусламжийн тоо — тайлангийн үндсэн тоо тул баазад
    const totals = await db.execute<{
      household_id: string;
      total: number;
      times: number;
    }>(sql`
      select
        household_id,
        coalesce(sum(amount), 0)::int as total,
        count(*)::int as times
      from welfare_aids
      group by household_id
    `);

    const lastByHousehold = new Map(
      latest.rows.map((row) => [
        row.household_id,
        {
          description: row.description,
          amount: row.amount,
          providedAt: row.provided_at,
        },
      ])
    );

    const totalByHousehold = new Map(
      totals.rows.map((row) => [
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

    const [created] = await db
      .insert(welfareHouseholds)
      .values({
        ...parsed.value,
        name: parsed.value.name as string,
        lat: parsed.value.lat as number,
        lng: parsed.value.lng as number,
        createdBy: result.caller.uid,
      })
      .returning();

    return NextResponse.json({ household: created });
  } catch (error) {
    return serverError(error, "Өрх бүртгэхэд алдаа гарлаа");
  }
}