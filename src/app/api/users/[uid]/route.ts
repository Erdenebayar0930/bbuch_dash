import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  forbidden,
  requireAdmin,
  serverError,
  toActor,
} from "@/lib/api/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  asRole,
  canChangeKhoroo,
  canChangeRole,
  canChangeStatus,
  keepsLastSuper,
  type Permission,
  type Target,
  type UserRole,
  type UserStatus,
} from "@/lib/permissions";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roles = new Set<UserRole>(["super", "admin", "user"]);
const statuses = new Set<UserStatus>(["active", "pending", "blocked"]);

/** Идэвхтэй супер админы тоо — хүсэлт тутамд нэг удаа л уншина. */
function activeSuperCounter() {
  let cached: Promise<number> | null = null;

  return () => {
    cached ??= db
      .select({ uid: users.uid })
      .from(users)
      .where(and(eq(users.role, "super"), eq(users.status, "active")))
      .then((rows) => rows.length);

    return cached;
  };
}

/**
 * Хэрэглэгчийн эрх / төлөв / хороог өөрчилнө.
 *
 * Шалгалт нь шатлалтай: эрх олгохыг зөвхөн супер админ хийнэ, төлөв ба хороог
 * админ хийж болох ч зөвхөн өөрөөсөө доогуур эрхтэй хэрэглэгч дээр. Дүрмүүд
 * @/lib/permissions дотор — UI ч мөн адил тэндээс уншина.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { uid } = await context.params;
  const actor = toActor(result.caller);
  const countActiveSupers = activeSuperCounter();

  try {
    const body = await request.json();

    const [targetRow] = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);

    if (!targetRow) {
      return NextResponse.json({ error: "Хэрэглэгч олдсонгүй." }, { status: 404 });
    }

    const target: Target = { uid: targetRow.uid, role: asRole(targetRow.role) };
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const checks: Permission[] = [];

    if (body.role !== undefined) {
      if (!roles.has(body.role)) return badRequest("role утга буруу байна.");

      checks.push(
        canChangeRole(actor, target, body.role),
        keepsLastSuper(target, await countActiveSupers(), { nextRole: body.role })
      );
      patch.role = body.role;
    }

    if (body.status !== undefined) {
      if (!statuses.has(body.status)) {
        return badRequest("status утга буруу байна.");
      }

      checks.push(
        canChangeStatus(actor, target),
        keepsLastSuper(target, await countActiveSupers(), {
          nextStatus: body.status,
        })
      );
      patch.status = body.status;
    }

    if (body.khoroo !== undefined) {
      if (body.khoroo !== null && typeof body.khoroo !== "number") {
        return badRequest("khoroo нь тоо эсвэл null байна.");
      }

      checks.push(canChangeKhoroo(actor, target));
      patch.khoroo = body.khoroo;
    }

    if (Object.keys(patch).length === 1) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    const denied = checks.find((check) => !check.allowed);
    if (denied && !denied.allowed) return forbidden(denied.reason);

    const [updated] = await db
      .update(users)
      .set(patch)
      .where(eq(users.uid, uid))
      .returning();

    return NextResponse.json({ user: updated });
  } catch (error) {
    return serverError(error, "Хэрэглэгчийг шинэчлэхэд алдаа гарлаа");
  }
}
