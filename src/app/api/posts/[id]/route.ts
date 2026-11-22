import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { TAGGABLE_BOARDS, isPostBoard } from "@/data/postOptions";
import { badRequest, forbidden, requireActiveUser, serverError } from "@/lib/api/auth";
import { periodDate, readPost, readPostRow } from "@/lib/api/postInput";
import { canApprovePosts, notifyPostApprovers, readPostApprovers } from "@/lib/api/postReview";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { isAdminRole } from "@/lib/permissions";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Нийтлэлийн бичсэн хүн, файлыг уншина — эрх шалгахад */
async function findPost(id: string) {
  if (!UUID.test(id)) return null;
  const [row] = await db
    .select({ authorUid: posts.authorUid, media: posts.media, board: posts.board, period: posts.period })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  return row ?? null;
}

/** Нийтлэлийг засна — зөвхөн бичсэн хүн өөрөө. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const { caller } = result;
  const { id } = await context.params;

  try {
    const existing = await findPost(id);
    if (!existing) return notFound();
    if (existing.authorUid !== caller.uid) {
      return forbidden("Зөвхөн өөрийн нийтлэлээ засна.");
    }

    const parsed = readPost(
      await request.json().catch(() => ({})),
      caller.uid,
      (existing.media ?? []).map((item) => item.path),
      isPostBoard(existing.board) && TAGGABLE_BOARDS.has(existing.board)
    );
    if (!parsed.ok) return badRequest(parsed.error);

    // Засвар нь дахин зөвшөөрөл шаардана — зөвшөөрөгч өөрөө засвал шууд
    const approver = canApprovePosts(caller, await readPostApprovers());
    const now = new Date();

    await db
      .update(posts)
      .set({
        ...parsed.value,
        updatedAt: now,
        // Он сар өөрчлөгдвөл жагсаалтын байр нь ч дагаж шилжинэ
        ...(parsed.value.period && parsed.value.period !== existing.period
          ? { createdAt: periodDate(parsed.value.period, now) }
          : {}),
        reviewNote: "",
        ...(approver
          ? { status: "approved", reviewedBy: caller.uid, reviewedAt: now }
          : { status: "pending", reviewedBy: null, reviewedAt: null }),
      })
      .where(eq(posts.id, id));

    if (!approver) await notifyPostApprovers({ ...parsed.value, board: existing.board }, caller.uid, true);

    return NextResponse.json({ post: await readPostRow(id) });
  } catch (error) {
    return serverError(error, "Нийтлэл засахад алдаа гарлаа");
  }
}

/** Нийтлэлийг устгана — бичсэн хүн эсвэл админ. Файлыг клиент цэвэрлэнэ. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const { caller } = result;
  const { id } = await context.params;

  try {
    const existing = await findPost(id);
    if (!existing) return notFound();
    if (existing.authorUid !== caller.uid && !isAdminRole(caller.user?.role)) {
      return forbidden("Зөвхөн өөрийн нийтлэлээ устгана.");
    }

    await db.delete(posts).where(eq(posts.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Нийтлэл устгахад алдаа гарлаа");
  }
}
