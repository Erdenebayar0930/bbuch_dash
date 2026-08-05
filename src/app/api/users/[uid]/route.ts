import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  forbidden,
  requireAdmin,
  serverError,
  toActor,
} from "@/lib/api/auth";
import { aimags, isValidOption } from "@/data/profileOptions";
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

/** Нэг хүнд оноож болох дуудлагын дээд тоо */
const MAX_CALLINGS = 5;

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Олон аймаг — жагсаалтад байгаа утга, давхардалгүй */
function readAimags(input: unknown): Parsed<string[]> {
  if (!Array.isArray(input)) {
    return { ok: false, error: "aimags нь жагсаалт байх ёстой." };
  }

  const seen: string[] = [];

  for (const item of input) {
    if (typeof item !== "string" || item === "" || !isValidOption(aimags, item)) {
      return { ok: false, error: `Аймаг буруу байна: ${String(item)}` };
    }
    if (!seen.includes(item)) seen.push(item);
  }

  return { ok: true, value: seen };
}

/** Дуудлагууд — чөлөөт текст, дээд тал нь MAX_CALLINGS */
function readCallings(input: unknown): Parsed<string[]> {
  if (!Array.isArray(input)) {
    return { ok: false, error: "callings нь жагсаалт байх ёстой." };
  }

  const result: string[] = [];

  for (const item of input) {
    if (typeof item !== "string") {
      return { ok: false, error: "Дуудлага нь текст байх ёстой." };
    }

    const value = item.trim();
    // Хоосон мөрийг чимээгүй алгасна — маягт дээр бөглөөгүй мөр үлдэж болно
    if (value === "") continue;
    if (value.length > 100) {
      return { ok: false, error: "Дуудлага 100 тэмдэгтээс урт байж болохгүй." };
    }
    if (!result.includes(value)) result.push(value);
  }

  if (result.length > MAX_CALLINGS) {
    return {
      ok: false,
      error: `Дуудлага дээд тал нь ${MAX_CALLINGS} байна.`,
    };
  }

  return { ok: true, value: result };
}

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

    // Аймаг ба дуудлага нь эрхийн шатлалд нөлөөлөхгүй бүлэг — хороотой ижил
    // шалгалт. Хэрэглэгч өөрөө эдгээрийг засах боломжгүй (/api/users/me-д алга).
    if (body.aimags !== undefined) {
      const parsed = readAimags(body.aimags);
      if (!parsed.ok) return badRequest(parsed.error);

      checks.push(canChangeKhoroo(actor, target));
      patch.aimags = parsed.value;
    }

    if (body.callings !== undefined) {
      const parsed = readCallings(body.callings);
      if (!parsed.ok) return badRequest(parsed.error);

      checks.push(canChangeKhoroo(actor, target));
      patch.callings = parsed.value;
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
