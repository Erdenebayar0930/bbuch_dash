import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  forbidden,
  requireActiveUser,
  serverError,
} from "@/lib/api/auth";
import { readFeedback } from "@/lib/api/feedback";
import { notifyUsers, resolveNotifyTargets } from "@/lib/api/notify";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Нэмэлт тайлбар" асуултад хариу бичнэ — ЗӨВХӨН саналыг бичсэн хүн, зөвхөн
 * тэр төлөвт байхад. Хариу бичмэгц төлөв "Хүлээгдэж байгаа" руу буцаж,
 * админууд мэдэгдэл авна.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) return badRequest("Хариугаа бичнэ үү.");
    if (text.length > 5000) {
      return badRequest("Хариу 5000 тэмдэгтээс урт байж болохгүй.");
    }

    const [current] = await db
      .select({
        authorUid: feedback.authorUid,
        title: feedback.title,
        status: feedback.status,
        adminNote: feedback.adminNote,
        replies: feedback.replies,
      })
      .from(feedback)
      .where(eq(feedback.id, id))
      .limit(1);

    if (!current) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }
    if (current.authorUid !== result.caller.uid) {
      return forbidden("Зөвхөн саналыг бичсэн хүн хариу бичнэ.");
    }
    if (current.status !== "needs_info") {
      return badRequest("Энэ санал нэмэлт тайлбар хүлээгээгүй байна.");
    }

    const now = new Date();

    await db
      .update(feedback)
      .set({
        replies: [
          ...(current.replies ?? []),
          { question: current.adminNote, text, at: now.toISOString() },
        ],
        status: "pending",
        statusUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(feedback.id, id));

    const [admins, supers] = await Promise.all([
      resolveNotifyTargets({ type: "role", role: "admin" }),
      resolveNotifyTargets({ type: "role", role: "super" }),
    ]);

    await notifyUsers(
      [...admins, ...supers].filter((uid) => uid !== result.caller.uid),
      {
        title: "Санал хүсэлтэд нэмэлт тайлбар ирлээ",
        body: `${current.title} — ${text}`,
        url: "/feedback",
      },
      result.caller.uid
    );

    return NextResponse.json({ feedback: await readFeedback(id) });
  } catch (error) {
    return serverError(error, "Хариу илгээхэд алдаа гарлаа");
  }
}
