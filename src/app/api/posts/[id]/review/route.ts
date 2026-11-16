import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, forbidden, requireActiveUser, serverError } from "@/lib/api/auth";
import { readPostRow } from "@/lib/api/postInput";
import { canApprovePosts, notifyPostAuthor, readPostApprovers } from "@/lib/api/postReview";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Нийтлэлийг хянана — `{ action: "approve" }` эсвэл `{ action: "reject", note }`.
 * Зөвхөн зөвшөөрөгч (сонгоогүй бол админ). Бичсэн хүнд мэдэгдэл очно.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const { caller } = result;
  if (!canApprovePosts(caller, await readPostApprovers())) {
    return forbidden("Нийтлэл зөвшөөрөх эрхгүй.");
  }

  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action;
    const note = typeof body.note === "string" ? body.note.trim() : "";

    if (action !== "approve" && action !== "reject") {
      return badRequest("action нь approve эсвэл reject байна.");
    }
    if (note.length > 2000) return badRequest("Тайлбар хэт урт байна.");

    const status = action === "approve" ? "approved" : "rejected";
    const now = new Date();

    const [updated] = await db
      .update(posts)
      .set({
        status,
        reviewNote: status === "rejected" ? note : "",
        reviewedBy: caller.uid,
        reviewedAt: now,
      })
      .where(eq(posts.id, id))
      .returning({ authorUid: posts.authorUid, board: posts.board });
    if (!updated) return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

    await notifyPostAuthor(updated.authorUid, updated.board, status, note, caller.uid);

    return NextResponse.json({ post: await readPostRow(id) });
  } catch (error) {
    return serverError(error, "Нийтлэл хянахад алдаа гарлаа");
  }
}
