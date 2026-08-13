import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireActiveUser, serverError } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Нэг удаад буцаах мэдэгдлийн дээд тоо */
const PAGE_SIZE = 50;

/** Өөрийн мэдэгдлүүд — шинэ нь эхэндээ, уншаагүйн тоотой хамт. */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const caller = result.caller;

  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.uid, caller.uid))
      .orderBy(desc(notifications.createdAt))
      .limit(PAGE_SIZE);

    const [counted] = await db
      .select({ unread: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(eq(notifications.uid, caller.uid), isNull(notifications.readAt))
      );

    return NextResponse.json({
      notifications: rows,
      unread: counted?.unread ?? 0,
    });
  } catch (error) {
    return serverError(error, "Мэдэгдэл уншихад алдаа гарлаа");
  }
}

/**
 * Уншсан болгож тэмдэглэнэ.
 *   { all: true }        — бүгдийг
 *   { ids: ["..."] }     — сонгосныг
 *
 * Зөвхөн ӨӨРИЙН мөрүүдэд нөлөөлнө — uid шүүлтүүр бүх тохиолдолд байна.
 */
export async function PATCH(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const caller = result.caller;

  try {
    const body = await request.json().catch(() => ({}));
    const now = new Date();

    if (body.all === true) {
      // MySQL нь UPDATE ... RETURNING дэмждэггүй. Энд зөвхөн ЗАССАН МӨРИЙН ТОО
      // хэрэгтэй тул үр дүнгийн `affectedRows`-ыг шууд авна — нэмэлт асуулга
      // хийх шаардлагагүй.
      const [res] = await db
        .update(notifications)
        .set({ readAt: now })
        .where(
          and(eq(notifications.uid, caller.uid), isNull(notifications.readAt))
        );

      return NextResponse.json({ updated: res.affectedRows });
    }

    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return badRequest("ids эсвэл all: true шаардлагатай.");
    }

    if (body.ids.some((id: unknown) => typeof id !== "string")) {
      return badRequest("ids нь текстийн жагсаалт байх ёстой.");
    }

    const [res] = await db
      .update(notifications)
      .set({ readAt: now })
      .where(
        and(
          eq(notifications.uid, caller.uid),
          inArray(notifications.id, body.ids as string[]),
          isNull(notifications.readAt)
        )
      );

    return NextResponse.json({ updated: res.affectedRows });
  } catch (error) {
    return serverError(error, "Мэдэгдэл тэмдэглэхэд алдаа гарлаа");
  }
}
