import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  getCaller,
  requireActiveUser,
  serverError,
  unauthorized,
} from "@/lib/api/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

function isStoragePhotoUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && STORAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** Өөрийн профайлыг уншина. */
export async function GET(request: NextRequest) {
  const caller = await getCaller(request);
  if (!caller) return unauthorized();

  return NextResponse.json({ user: caller.user });
}

/**
 * Өөрийн профайлаа шинэчилнэ.
 * role, status-ыг энд өөрчилж болохгүй — зөвхөн админы route-аар.
 */
export async function PATCH(request: NextRequest) {
  // GET нь getCaller дээр үлддэг — клиент өөрийн төлөвөө уншиж чадах ёстой,
  // эс бөгөөс хаагдсанаа мэдэхгүй. Харин БИЧИХ эрх идэвхтэй хүнд л байна.
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const caller = result.caller;

  try {
    const body = await request.json();
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    for (const key of ["firstName", "lastName", "phone", "position"] as const) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== "string") {
          return badRequest(`${key} нь текст байх ёстой.`);
        }
        patch[key] = body[key];
      }
    }

    // Зөвхөн Firebase Storage-ийн хаяг зөвшөөрнө — дурын URL профайл руу
    // оруулахаас сэргийлнэ. Хоосон мөр нь зургийг авах гэсэн үг.
    if (body.photoUrl !== undefined) {
      if (typeof body.photoUrl !== "string") {
        return badRequest("photoUrl нь текст байх ёстой.");
      }
      if (body.photoUrl !== "" && !isStoragePhotoUrl(body.photoUrl)) {
        return badRequest("photoUrl нь Firebase Storage-ийн хаяг байх ёстой.");
      }
      patch.photoUrl = body.photoUrl;
    }

    if (body.khoroo !== undefined) {
      if (body.khoroo !== null && typeof body.khoroo !== "number") {
        return badRequest("khoroo нь тоо эсвэл null байна.");
      }
      patch.khoroo = body.khoroo;
    }

    if (Object.keys(patch).length === 1) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    const [updated] = await db
      .update(users)
      .set(patch)
      .where(eq(users.uid, caller.uid))
      .returning();

    return NextResponse.json({ user: updated });
  } catch (error) {
    return serverError(error, "Профайл шинэчлэхэд алдаа гарлаа");
  }
}
