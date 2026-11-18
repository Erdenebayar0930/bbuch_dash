import { and, desc, eq, lt, ne, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, isAdminRole, requireActiveUser, requireAimag, serverError } from "@/lib/api/auth";
import { RESTRICTED_BOARDS, isPostBoard, type PostBoard } from "@/data/postOptions";
import { periodDate, postColumns, readPost, readPostRow } from "@/lib/api/postInput";
import { canApprovePosts, notifyPostApprovers, readPostApprovers } from "@/lib/api/postReview";
import { db } from "@/lib/db";
import { posts, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Нэг удаад буцаах нийтлэлийн тоо */
const PAGE_SIZE = 20;

/** Зөвшөөрөгдөөгүй нийтлэлийн дээд тоо — нэг дор */
const QUEUE_LIMIT = 100;

/** `?board=` — хоосон бол нүүр хуудас */
const readBoard = (request: NextRequest): PostBoard | null => {
  const raw = request.nextUrl.searchParams.get("board") || "home";
  return isPostBoard(raw) ? raw : null;
};

/** Хязгаартай самбар (Д.У.Т) бол харьяалал шалгана, бусад нь идэвхтэй хэрэглэгч бүр */
const requireBoardAccess = (request: NextRequest) => {
  const raw = request.nextUrl.searchParams.get("board") || "home";
  const aimag = isPostBoard(raw) ? RESTRICTED_BOARDS[raw] : undefined;
  return aimag ? requireAimag(request, aimag) : requireActiveUser(request);
};

/**
 * Нүүр хуудасны (эсвэл `?board=`-ын) нийтлэлүүд — шинээс хуучин руу. Идэвхтэй хэрэглэгч бүр.
 *
 * `posts` — зөвшөөрөгдсөн нийтлэлүүд, `?before=<ISO>` нь дараагийн хуудас.
 * `queue` — зөвшөөрөгдөөгүй (хүлээгдэж буй/буцаасан): зөвшөөрөгч ба админд
 * бүгд, бусдад зөвхөн өөрийнх. Эхний хуудсанд л буцна.
 */
export async function GET(request: NextRequest) {
  const result = await requireBoardAccess(request);
  if ("error" in result) return result.error;

  const { caller } = result;
  const board = readBoard(request);
  if (!board) return badRequest("board буруу байна.");
  const beforeRaw = request.nextUrl.searchParams.get("before");
  const before = beforeRaw ? new Date(beforeRaw) : null;
  if (before && Number.isNaN(before.getTime())) return badRequest("before буруу байна.");

  try {
    const approver = canApprovePosts(caller, await readPostApprovers());
    const seesAll = approver || isAdminRole(caller.user?.role);

    const rows = await db
      .select(postColumns)
      .from(posts)
      .leftJoin(users, eq(posts.authorUid, users.uid))
      .where(
        and(
          eq(posts.board, board),
          eq(posts.status, "approved"),
          before ? lt(posts.createdAt, before) : undefined
        )
      )
      .orderBy(desc(posts.createdAt))
      .limit(PAGE_SIZE + 1);

    const queue = before
      ? []
      : await db
          .select(postColumns)
          .from(posts)
          .leftJoin(users, eq(posts.authorUid, users.uid))
          .where(
            seesAll
              ? // Зөвшөөрөгч бусдын буцаасныг биш, хүлээгдэж буйг ба өөрийнхөө бүгдийг харна
                and(
                  eq(posts.board, board),
                  ne(posts.status, "approved"),
                  or(eq(posts.status, "pending"), eq(posts.authorUid, caller.uid))
                )
              : and(
                  eq(posts.board, board),
                  ne(posts.status, "approved"),
                  eq(posts.authorUid, caller.uid)
                )
          )
          .orderBy(desc(posts.createdAt))
          .limit(QUEUE_LIMIT);

    return NextResponse.json({
      posts: rows.slice(0, PAGE_SIZE),
      hasMore: rows.length > PAGE_SIZE,
      queue,
      canApprove: approver,
    });
  } catch (error) {
    return serverError(error, "Нийтлэл уншихад алдаа гарлаа");
  }
}

/** Шинэ нийтлэл — идэвхтэй хэрэглэгч бүр. Зөвшөөрөгч бол шууд нийтлэгдэнэ. */
export async function POST(request: NextRequest) {
  const result = await requireBoardAccess(request);
  if ("error" in result) return result.error;

  const { caller } = result;
  const board = readBoard(request);
  if (!board) return badRequest("board буруу байна.");

  try {
    const parsed = readPost(await request.json().catch(() => ({})), caller.uid);
    if (!parsed.ok) return badRequest(parsed.error);

    const approver = canApprovePosts(caller, await readPostApprovers());
    const now = new Date();
    // Сонгосон огноо нь нийтэлсэн огноо — тэр өдрийнхөө байранд эрэмбэлэгдэнэ.
    // updatedAt-ыг тэнцүү тавьснаар «Засагдсан» гэж гарахгүй.
    const postedAt = periodDate(parsed.value.period, now);

    const [created] = await db
      .insert(posts)
      .values({
        board,
        authorUid: caller.uid,
        ...parsed.value,
        createdAt: postedAt,
        updatedAt: postedAt,
        ...(approver
          ? { status: "approved", reviewedBy: caller.uid, reviewedAt: now }
          : { status: "pending" }),
      })
      .returning({ id: posts.id });

    if (!approver) await notifyPostApprovers({ ...parsed.value, board }, caller.uid, false);

    return NextResponse.json({ post: await readPostRow(created.id) });
  } catch (error) {
    return serverError(error, "Нийтлэхэд алдаа гарлаа");
  }
}
