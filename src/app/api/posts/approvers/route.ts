import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { readPostApprovers as readApprovers, writePostApprovers as writeApprovers } from "@/lib/api/postReview";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Нүүр хуудасны нийтлэл зөвшөөрөх эрхтэй хүмүүс — зөвхөн админ. */
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    return NextResponse.json({ uids: await readApprovers() });
  } catch (error) {
    return serverError(error, "Зөвшөөрөгчдийг уншихад алдаа гарлаа");
  }
}

/** Зөвшөөрөгчдийг солино — `{ uids: string[] }`, зөвхөн админ. Хоосон = админ зөвшөөрнө. */
export async function PUT(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.uids) || body.uids.some((uid: unknown) => typeof uid !== "string")) {
      return badRequest("uids нь мөрүүдийн жагсаалт байна.");
    }
    const uids = [...new Set(body.uids as string[])];
    if (uids.length > 50) return badRequest("Хэт олон хүн сонгосон байна.");

    if (uids.length > 0) {
      const found = await db
        .select({ uid: users.uid })
        .from(users)
        .where(and(inArray(users.uid, uids), eq(users.status, "active")));
      if (found.length !== uids.length) {
        return badRequest("Зарим хэрэглэгч олдсонгүй эсвэл идэвхгүй байна.");
      }
    }

    await writeApprovers(uids);
    return NextResponse.json({ uids });
  } catch (error) {
    return serverError(error, "Зөвшөөрөгчдийг хадгалахад алдаа гарлаа");
  }
}
