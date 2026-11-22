import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, serverError } from "@/lib/api/auth";
import { isUuid, notFound, readUpdateRows, requireTaskAccess } from "@/lib/api/taskProgress";
import { db } from "@/lib/db";
import { taskPollVotes, taskUpdates } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Санал өгнө — `{ optionIds: string[] }`. Өмнөх саналыг бүхэлд нь сольно;
 * хоосон жагсаалт нь саналаа буцаана. Ганц сонголттой асуулгад нэгээс олныг
 * сонгож болохгүй.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; updateId: string }> }
) {
  const { id, updateId } = await context.params;
  const access = await requireTaskAccess(request, id);
  if ("error" in access) return access.error;
  if (!isUuid(updateId)) return notFound();

  const me = access.caller.uid;

  try {
    const [update] = await db
      .select({ poll: taskUpdates.poll })
      .from(taskUpdates)
      .where(and(eq(taskUpdates.id, updateId), eq(taskUpdates.taskId, id)))
      .limit(1);

    if (!update) return notFound();
    if (!update.poll) return badRequest("Энэ бичлэгт санал асуулга байхгүй.");

    const body = (await request.json().catch(() => ({}))) as { optionIds?: unknown };
    const valid = new Set(update.poll.options.map((option) => option.id));
    const optionIds = [
      ...new Set(
        (Array.isArray(body.optionIds) ? body.optionIds : []).filter(
          (value): value is string => typeof value === "string" && valid.has(value)
        )
      ),
    ];

    if (!update.poll.multi && optionIds.length > 1) {
      return badRequest("Зөвхөн нэг сонголт хийнэ.");
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(taskPollVotes)
        .where(and(eq(taskPollVotes.updateId, updateId), eq(taskPollVotes.uid, me)));
      if (optionIds.length > 0) {
        await tx
          .insert(taskPollVotes)
          .values(optionIds.map((optionId) => ({ updateId, uid: me, optionId })));
      }
    });

    const [row] = await readUpdateRows(eq(taskUpdates.id, updateId), me);
    return NextResponse.json({ update: row });
  } catch (error) {
    return serverError(error, "Санал өгөхөд алдаа гарлаа");
  }
}
