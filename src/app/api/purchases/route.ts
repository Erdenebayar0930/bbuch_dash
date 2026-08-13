import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { isPurchaseStatus } from "@/data/supplyOptions";
import { badRequest, requireAimag, serverError } from "@/lib/api/auth";
import { purchaseColumns, requesterJoin } from "@/lib/api/purchases";
import { readPurchase } from "@/lib/api/purchaseInput";
import { db } from "@/lib/db";
import { purchaseRequests, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Худалдан авалт нь Хангамжийн аймгийн хариуцлага */
const AIMAG = "supply";

/**
 * Худалдан авах жагсаалт — шинэ хүсэлт эхэндээ.
 *
 * `?status=requested` — нэг төлөвөөр шүүнэ. Зөвхөн Хангамжийн аймгийн гишүүд
 * ба админ уншина.
 */
export async function GET(request: NextRequest) {
  const result = await requireAimag(request, AIMAG);
  if ("error" in result) return result.error;

  const status = request.nextUrl.searchParams.get("status");
  if (status !== null && !isPurchaseStatus(status)) {
    return badRequest("Төлөв буруу байна.");
  }

  try {
    const rows = await db
      .select(purchaseColumns)
      .from(purchaseRequests)
      .leftJoin(users, requesterJoin)
      .where(status === null ? undefined : eq(purchaseRequests.status, status))
      .orderBy(desc(purchaseRequests.createdAt));

    return NextResponse.json({ purchases: rows });
  } catch (error) {
    return serverError(error, "Худалдан авах жагсаалт уншихад алдаа гарлаа");
  }
}

/**
 * Шинэ хүсэлт нэмнэ.
 *
 * Аймгийн гишүүн бол админ биш ч хүсэлт гаргаж болно — хэрэгцээг мэдэх хүн нь
 * ихэвчлэн ашиглагч өөрөө. Гэхдээ төлөвийг эхнээс нь өөрөө сонгож чадахгүй:
 * бүх шинэ мөр `requested` төлөвөөр орж, зөвшөөрөхийг админ шийднэ.
 */
export async function POST(request: NextRequest) {
  const result = await requireAimag(request, AIMAG);
  if ("error" in result) return result.error;

  try {
    const parsed = await readPurchase(
      await request.json().catch(() => ({})),
      false
    );
    if (!parsed.ok) return badRequest(parsed.error);

    // MySQL нь INSERT ... RETURNING дэмждэггүй — ID-г урьдчилж үүсгэнэ
    const id = crypto.randomUUID();

    await db.insert(purchaseRequests).values({
      ...parsed.value,
      id,
      name: parsed.value.name as string,
      status: "requested",
      // Хүсэгчийг клиентээс биш токеноос авна — өөр хүний нэрээр бичихээс сэргийлнэ
      requestedBy: result.caller.uid,
      createdBy: result.caller.uid,
    });

    const [row] = await db
      .select(purchaseColumns)
      .from(purchaseRequests)
      .leftJoin(users, requesterJoin)
      .where(eq(purchaseRequests.id, id))
      .limit(1);

    return NextResponse.json({ purchase: row });
  } catch (error) {
    return serverError(error, "Хүсэлт нэмэхэд алдаа гарлаа");
  }
}