import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import { readFeedback } from "@/lib/api/feedback";
import { notifyUsers } from "@/lib/api/notify";
import {
  feedbackNoteRequired,
  feedbackStatusLabels,
  isFeedbackStatus,
} from "@/data/feedbackOptions";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Явцыг шинэчилнэ (зөвхөн админ).
 *
 * "Татгалзсан" ба "Нэмэлт тайлбар" төлөвт тайлбар заавал — хэрэглэгч яагаад
 * татгалзсан, юу нэмж хэлэх ёстойгоо мэдэх ёстой. Бичсэн хүнд мэдэгдэл очно.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const status = body?.status;
    const adminNote =
      typeof body?.adminNote === "string" ? body.adminNote.trim() : "";

    if (!isFeedbackStatus(status)) return badRequest("Төлөв буруу байна.");
    if (feedbackNoteRequired.includes(status) && !adminNote) {
      return badRequest(
        status === "rejected"
          ? "Татгалзсан шалтгааныг оруулна уу."
          : "Ямар нэмэлт тайлбар хэрэгтэйг бичнэ үү."
      );
    }
    if (adminNote.length > 2000) {
      return badRequest("Тайлбар 2000 тэмдэгтээс урт байж болохгүй.");
    }

    const [current] = await db
      .select({ authorUid: feedback.authorUid, title: feedback.title })
      .from(feedback)
      .where(eq(feedback.id, id))
      .limit(1);

    if (!current) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    await db
      .update(feedback)
      .set({
        status,
        adminNote,
        statusUpdatedBy: result.caller.uid,
        statusUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(feedback.id, id));

    if (current.authorUid && current.authorUid !== result.caller.uid) {
      await notifyUsers(
        [current.authorUid],
        {
          title: `Санал хүсэлт: ${feedbackStatusLabels[status]}`,
          body: adminNote ? `${current.title} — ${adminNote}` : current.title,
          url: "/feedback",
        },
        result.caller.uid
      );
    }

    return NextResponse.json({ feedback: await readFeedback(id) });
  } catch (error) {
    return serverError(error, "Төлөв шинэчлэхэд алдаа гарлаа");
  }
}

/** Санал хүсэлтийг устгана (зөвхөн админ). Зургийн замыг буцаана. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const [existing] = await db
      .select({ images: feedback.images })
      .from(feedback)
      .where(eq(feedback.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    await db.delete(feedback).where(eq(feedback.id, id));

    return NextResponse.json({
      ok: true,
      imagePaths: (existing.images ?? []).map((image) => image.path),
    });
  } catch (error) {
    return serverError(error, "Санал хүсэлт устгахад алдаа гарлаа");
  }
}
