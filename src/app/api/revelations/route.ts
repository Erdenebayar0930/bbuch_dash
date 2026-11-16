import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { aimags, isValidOption } from "@/data/profileOptions";
import { badRequest, requireAimag, serverError } from "@/lib/api/auth";
import {
  readRevelation,
  readRevelationRow,
  revelationColumns,
} from "@/lib/api/revelationInput";
import { revelationTable } from "@/lib/api/dataBoard";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Нэг удаад буцаах нийтлэлийн тоо */
const PAGE_SIZE = 100;

/** `?aimag=` нь мэдэгдэж буй аймаг байх ёстой */
const readAimag = (request: NextRequest) => {
  const aimag = request.nextUrl.searchParams.get("aimag") ?? "";
  return aimag && isValidOption(aimags, aimag) ? aimag : null;
};

/** Тухайн аймгийн нийтлэлүүд — шинээс хуучин руу. Аймгийн гишүүн эсвэл админ. */
export async function GET(request: NextRequest) {
  const aimag = readAimag(request);
  if (!aimag) return badRequest("aimag буруу байна.");

  const result = await requireAimag(request, aimag);
  if ("error" in result) return result.error;

  // Тахилтынх `tahilt` schema-д, бусад аймгийнх `public`-д
  const revelations = revelationTable(aimag);

  try {
    const rows = await db
      .select(revelationColumns(revelations))
      .from(revelations)
      .leftJoin(users, eq(revelations.authorUid, users.uid))
      .where(eq(revelations.aimag, aimag))
      // Илчлэл ирсэн өдрөөр — нөхөж оруулсан нь өөрийн байрандаа орно
      .orderBy(desc(revelations.revealedOn), desc(revelations.createdAt))
      .limit(PAGE_SIZE);

    return NextResponse.json({ revelations: rows });
  } catch (error) {
    return serverError(error, "Илчлэл уншихад алдаа гарлаа");
  }
}

/** Шинэ нийтлэл — тухайн аймгийн гишүүн эсвэл админ. */
export async function POST(request: NextRequest) {
  const aimag = readAimag(request);
  if (!aimag) return badRequest("aimag буруу байна.");

  const result = await requireAimag(request, aimag);
  if ("error" in result) return result.error;

  const { caller } = result;
  const revelations = revelationTable(aimag);

  try {
    const parsed = readRevelation(await request.json().catch(() => ({})), caller.uid);
    if (!parsed.ok) return badRequest(parsed.error);

    const [created] = await db
      .insert(revelations)
      .values({ aimag, authorUid: caller.uid, ...parsed.value })
      .returning({ id: revelations.id });

    return NextResponse.json({
      revelation: await readRevelationRow(revelations, created.id),
    });
  } catch (error) {
    return serverError(error, "Илчлэл нийтлэхэд алдаа гарлаа");
  }
}
