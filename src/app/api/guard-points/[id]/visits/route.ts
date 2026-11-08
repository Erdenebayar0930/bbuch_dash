import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  GUARD_AIMAG,
  MAX_GUARD_VISIT_NOTE,
  isGuardVisitStatus,
} from "@/data/guardOptions";
import {
  badRequest,
  requireAdmin,
  requireAimag,
  serverError,
} from "@/lib/api/auth";
import { db } from "@/lib/db";
import { guardPointVisits, guardPoints, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Нэг цэгийн түүхэнд буцаах эргэлтийн дээд тоо */
const HISTORY_LIMIT = 20;

/** Тухайн цэгийн эргэлтийн түүх — сүүлийнх нь эхэндээ. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAimag(request, GUARD_AIMAG);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const rows = await db
      .select({
        id: guardPointVisits.id,
        status: guardPointVisits.status,
        note: guardPointVisits.note,
        visitedAt: guardPointVisits.visitedAt,
        visitedByName: users.firstName,
        visitedByLastName: users.lastName,
      })
      .from(guardPointVisits)
      .leftJoin(users, eq(guardPointVisits.visitedBy, users.uid))
      .where(eq(guardPointVisits.pointId, id))
      .orderBy(desc(guardPointVisits.visitedAt))
      .limit(HISTORY_LIMIT);

    return NextResponse.json({ visits: rows });
  } catch (error) {
    return serverError(error, "Эргэлтийн түүх уншихад алдаа гарлаа");
  }
}

/**
 * Шинэ эргэлт бүртгэнэ (зөвхөн админ).
 *
 * Хуучин бүртгэлийг дарж бичихгүй — эргэлт бүр тусдаа мөр болж үлдэнэ.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const body = (await request
      .json()
      .catch(() => ({}))) as Record<string, unknown>;

    if (!isGuardVisitStatus(body.status)) {
      return badRequest("Байдал буруу байна.");
    }

    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > MAX_GUARD_VISIT_NOTE) {
      return badRequest(
        `Тэмдэглэл ${MAX_GUARD_VISIT_NOTE} тэмдэгтээс урт байж болохгүй.`
      );
    }

    const [point] = await db
      .select({ id: guardPoints.id })
      .from(guardPoints)
      .where(eq(guardPoints.id, id))
      .limit(1);

    if (!point) {
      return NextResponse.json({ error: "Цэг олдсонгүй." }, { status: 404 });
    }

    const [created] = await db
      .insert(guardPointVisits)
      .values({
        pointId: id,
        status: body.status,
        note,
        visitedBy: result.caller.uid,
      })
      .returning();

    return NextResponse.json({ visit: created });
  } catch (error) {
    return serverError(error, "Эргэлт бүртгэхэд алдаа гарлаа");
  }
}
