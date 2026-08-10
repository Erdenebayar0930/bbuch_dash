import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  forbidden,
  isAdminRole,
  requireAimag,
  serverError,
} from "@/lib/api/auth";
import { purchaseColumns, requesterJoin } from "@/lib/api/purchases";
import { readPurchase } from "@/lib/api/purchaseInput";
import { db } from "@/lib/db";
import { purchaseRequests, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Худалдан авалт нь Хангамжийн аймгийн хариуцлага */
const AIMAG = "supply";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/**
 * Хүсэлтийг засна.
 *
 * Төлөв өөрчлөх нь админы эрх — зөвшөөрөх, худалдаж авсныг батлах шийдвэрийг
 * хүсэгч өөрөө гаргаж болохгүй. Хүсэгч нь өөрийн `requested` төлөвтэй мөрийг
 * л засна: зөвшөөрөгдсөний дараа агуулга өөрчлөгдвөл шийдвэр утгагүй болно.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAimag(request, AIMAG);
  if ("error" in result) return result.error;

  const { id } = await context.params;
  const isAdmin = isAdminRole(result.caller.user?.role);

  try {
    const [existing] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, id))
      .limit(1);

    if (!existing) return notFound();

    const parsed = await readPurchase(
      await request.json().catch(() => ({})),
      true
    );
    if (!parsed.ok) return badRequest(parsed.error);

    const patch = parsed.value;
    if (Object.keys(patch).length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    if (!isAdmin) {
      if (existing.requestedBy !== result.caller.uid) {
        return forbidden("Зөвхөн өөрийн хүсэлтийг засна.");
      }
      if (existing.status !== "requested") {
        return forbidden("Шийдвэрлэгдсэн хүсэлтийг засах боломжгүй.");
      }
      if (patch.status !== undefined || patch.requestedBy !== undefined) {
        return forbidden("Төлөв ба хүсэгчийг зөвхөн админ өөрчилнө.");
      }
    }

    await db
      .update(purchaseRequests)
      .set({
        ...patch,
        // Худалдаж авсан гэж тэмдэглэсэн агшинг тэр үед нь бичнэ; буцаавал арилна
        ...(patch.status === undefined
          ? {}
          : { boughtAt: patch.status === "bought" ? new Date() : null }),
        updatedAt: new Date(),
      })
      .where(eq(purchaseRequests.id, id));

    const [row] = await db
      .select(purchaseColumns)
      .from(purchaseRequests)
      .leftJoin(users, requesterJoin)
      .where(eq(purchaseRequests.id, id))
      .limit(1);

    return NextResponse.json({ purchase: row });
  } catch (error) {
    return serverError(error, "Хүсэлт засахад алдаа гарлаа");
  }
}

/** Хүсэлтийг устгана — админ, эсвэл өөрийн шийдвэрлэгдээгүй хүсэлтээ хүсэгч. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAimag(request, AIMAG);
  if ("error" in result) return result.error;

  const { id } = await context.params;
  const isAdmin = isAdminRole(result.caller.user?.role);

  try {
    const [existing] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, id))
      .limit(1);

    if (!existing) return notFound();

    if (!isAdmin) {
      if (existing.requestedBy !== result.caller.uid) {
        return forbidden("Зөвхөн өөрийн хүсэлтийг устгана.");
      }
      if (existing.status !== "requested") {
        return forbidden("Шийдвэрлэгдсэн хүсэлтийг устгах боломжгүй.");
      }
    }

    await db.delete(purchaseRequests).where(eq(purchaseRequests.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Хүсэлт устгахад алдаа гарлаа");
  }
}