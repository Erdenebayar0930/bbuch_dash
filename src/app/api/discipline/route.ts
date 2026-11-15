import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, isAdminRole, requireAdmin, serverError } from "@/lib/api/auth";
import {
  DISCIPLINE_AIMAG,
  readDisciplineAmount,
  requireDisciplineAccess,
  writeDisciplineAmount,
  writeDisciplineChecker,
} from "@/lib/api/discipline";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Сахилгажуулалтын тохиргоо — сар бүрийн дүн, чагтлагч, дуудагчийн эрх.
 * Хангамжийн аймгийн гишүүд ба админ.
 */
export async function GET(request: NextRequest) {
  const result = await requireDisciplineAccess(request);
  if ("error" in result) return result.error;

  try {
    let checker: { uid: string; firstName: string | null; lastName: string | null } | null =
      null;
    if (result.checkerUid) {
      const [row] = await db
        .select({ uid: users.uid, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.uid, result.checkerUid))
        .limit(1);
      checker = row ?? null;
    }

    return NextResponse.json({
      amount: await readDisciplineAmount(),
      checker,
      canCheck: result.canCheck,
      canView: result.canView,
    });
  } catch (error) {
    return serverError(error, "Тохиргоо уншихад алдаа гарлаа");
  }
}

/**
 * Дүн (`amount`) ба/эсвэл чагтлагч (`checkerUid`, "" = болих) солино —
 * зөвхөн админ. Чагтлагч нь Хангамжийн аймгийн идэвхтэй гишүүн эсвэл админ.
 */
export async function PATCH(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const body = await request.json().catch(() => ({}));

    if ("amount" in body) {
      const amount = Number(body.amount);
      if (!Number.isInteger(amount) || amount < 0 || amount > 1_000_000_000) {
        return badRequest("Дүн буруу байна.");
      }
      await writeDisciplineAmount(amount);
    }

    if ("checkerUid" in body) {
      const uid = typeof body.checkerUid === "string" ? body.checkerUid : null;
      if (uid === null) return badRequest("checkerUid буруу байна.");

      if (uid) {
        const [user] = await db
          .select({ status: users.status, role: users.role, aimags: users.aimags })
          .from(users)
          .where(eq(users.uid, uid))
          .limit(1);
        const eligible =
          user &&
          user.status === "active" &&
          (isAdminRole(user.role) || (user.aimags ?? []).includes(DISCIPLINE_AIMAG));
        if (!eligible) {
          return badRequest("Чагтлагч нь Хангамжийн аймгийн идэвхтэй гишүүн эсвэл админ байна.");
        }
      }
      await writeDisciplineChecker(uid);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Хадгалахад алдаа гарлаа");
  }
}
