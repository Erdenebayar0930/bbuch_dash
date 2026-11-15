import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { readSupply } from "@/lib/api/supplyInput";
import { db } from "@/lib/db";
import { churchSupplies } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Чуулганы хангамжийн бүх бүртгэл — шинээс хуучин руу. Зөвхөн админ. */
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select()
      .from(churchSupplies)
      .orderBy(desc(churchSupplies.receivedOn), desc(churchSupplies.createdAt));

    return NextResponse.json({ supplies: rows });
  } catch (error) {
    return serverError(error, "Хангамжийн бүртгэл уншихад алдаа гарлаа");
  }
}

/** Шинэ бүртгэл — орж ирсэн мөнгө эсвэл эд зүйл. Зөвхөн админ. */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const parsed = readSupply(await request.json().catch(() => ({})), false);
    if (!parsed.ok) return badRequest(parsed.error);

    const input = parsed.value;
    const [created] = await db
      .insert(churchSupplies)
      .values({
        ...input,
        kind: input.kind as string,
        title: input.title as string,
        receivedOn: input.receivedOn as string,
        createdBy: result.caller.uid,
      })
      .returning();

    return NextResponse.json({ supply: created });
  } catch (error) {
    return serverError(error, "Хангамж бүртгэхэд алдаа гарлаа");
  }
}
