import { and, asc, eq, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { forbidden, requireActiveUser, serverError } from "@/lib/api/auth";
import { aimags as aimagOptions, isValidOption } from "@/data/profileOptions";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { canManageProjects, canWorkInAnyAimag } from "@/lib/permissions";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Даалгаварт хариуцагч/хамтрагч сонгох жагсаалт — зөвхөн нэр, аймаг (утас,
 * имэйл зэрэг хувийн мэдээлэл ӨГӨХГҮЙ).
 *
 * `?aimags=a,b` — тэдгээр аймгийн аль нэгийн идэвхтэй гишүүд; дуудагч нь
 * тэдгээрийн аль нэгийн гишүүн эсвэл Харуул/админ байна. Аймаггүй бол бүх
 * идэвхтэй хэрэглэгч — зөвхөн Харуул/админ.
 */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const user = result.caller.user;
  const raw = new URL(request.url).searchParams.get("aimags") ?? "";
  const picked = [
    ...new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value && isValidOption(aimagOptions, value))
    ),
  ];

  const allowed =
    picked.length > 0
      ? canWorkInAnyAimag(user?.role, user?.aimags, picked)
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
          picked.length > 0
            ? or(
                ...picked.map(
                  (aimag) =>
                    sql`${users.aimags} @> ${JSON.stringify([aimag])}::jsonb`
                )
              )
            : undefined
        )
      )
      .orderBy(asc(users.firstName));

    return NextResponse.json({ people: rows });
  } catch (error) {
    return serverError(error, "Хэрэглэгчдийг уншихад алдаа гарлаа");
  }
}
