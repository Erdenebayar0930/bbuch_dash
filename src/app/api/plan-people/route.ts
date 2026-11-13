import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { forbidden, requireActiveUser, serverError } from "@/lib/api/auth";
import { aimags, isValidOption } from "@/data/profileOptions";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { canManageProjects, canWorkInAimag } from "@/lib/permissions";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Даалгаварт гүйцэтгэгч сонгох жагсаалт — зөвхөн нэр, аймаг (утас, имэйл
 * зэрэг хувийн мэдээлэл ӨГӨХГҮЙ).
 *
 * `?aimag=` — тухайн аймгийн идэвхтэй гишүүд; зөвхөн тэр аймгийн гишүүн
 * эсвэл Харуул/админ уншина. Аймаггүй бол бүх идэвхтэй хэрэглэгч — зөвхөн
 * Харуул/админ.
 */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const user = result.caller.user;
  const aimag = new URL(request.url).searchParams.get("aimag") ?? "";

  if (aimag && !isValidOption(aimags, aimag)) {
    return NextResponse.json({ people: [] });
  }

  const allowed = aimag
    ? canWorkInAimag(user?.role, user?.aimags, aimag)
    : canManageProjects(user?.role, user?.aimags);

  if (!allowed) return forbidden("Энэ жагсаалтыг үзэх эрхгүй.");

  try {
    const rows = await db
      .select({
        uid: users.uid,
        firstName: users.firstName,
        lastName: users.lastName,
        aimags: users.aimags,
      })
      .from(users)
      .where(
        and(
          eq(users.status, "active"),
          aimag
            ? sql`${users.aimags} @> ${JSON.stringify([aimag])}::jsonb`
            : undefined
        )
      )
      .orderBy(asc(users.firstName));

    return NextResponse.json({ people: rows });
  } catch (error) {
    return serverError(error, "Хэрэглэгчдийг уншихад алдаа гарлаа");
  }
}
