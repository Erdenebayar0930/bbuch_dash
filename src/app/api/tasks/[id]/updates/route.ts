import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, serverError } from "@/lib/api/auth";
import { notifyUsers } from "@/lib/api/notify";
import { planUrl } from "@/lib/api/planAccess";
import { readPost } from "@/lib/api/postInput";
import { readPoll, readUpdateRows, requireTaskAccess } from "@/lib/api/taskProgress";
import { db } from "@/lib/db";
import { taskUpdates } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Даалгаврын явцын мэдээлэл — шинэ өдрөөс хуучин руу. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireTaskAccess(request, id);
  if ("error" in access) return access.error;

  try {
    const updates = await readUpdateRows(eq(taskUpdates.taskId, id), access.caller.uid);
    return NextResponse.json({ updates, canManage: access.canManage });
  } catch (error) {
    return serverError(error, "Явцын мэдээлэл уншихад алдаа гарлаа");
  }
}

/** Шинэ явцын мэдээлэл — бичвэр, зураг/бичлэг/файл, санал асуулга. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireTaskAccess(request, id);
  if ("error" in access) return access.error;

  const { caller, task } = access;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const poll = readPoll(body.poll);
    if (!poll.ok) return badRequest(poll.error);

    // Санал асуулга дангаараа бичлэг болж болно: бичвэр, файлгүй үед огноо,
    // файлын шалгалтыг түр бичвэрээр давуулаад дараа нь хоослоно
    const pollOnly =
      !!poll.value &&
      !(typeof body.body === "string" && body.body.trim()) &&
      !(Array.isArray(body.media) && body.media.length > 0) &&
      !(typeof body.videoLink === "string" && body.videoLink.trim());

    const parsed = readPost(pollOnly ? { ...body, body: "·" } : body, caller.uid);
    if (!parsed.ok) return badRequest(parsed.error);

    const { body: text, media, videoLink, period } = parsed.value;

    const [created] = await db
      .insert(taskUpdates)
      .values({
        taskId: id,
        authorUid: caller.uid,
        body: pollOnly ? "" : text,
        media,
        videoLink,
        period,
        poll: poll.value,
      })
      .returning({ id: taskUpdates.id });

    // Хариуцагч, хамтрагчдад мэдэгдэнэ — бичсэн хүнээс бусдад
    const targets = [
      ...new Set(
        [task.assignedTo, ...(task.collaborators ?? [])].filter(
          (uid): uid is string => !!uid && uid !== caller.uid
        )
      ),
    ];
    if (targets.length > 0) {
      const summary = pollOnly
        ? `Санал асуулга: ${poll.value?.question ?? ""}`
        : text || "Шинэ зураг, файл";
      await notifyUsers(
        targets,
        { title: `Явц — ${task.title}`, body: summary.slice(0, 120), url: planUrl(task.aimags) },
        caller.uid
      ).catch((error) => console.warn("Явцын мэдэгдэл илгээж чадсангүй:", error));
    }

    const [row] = await readUpdateRows(eq(taskUpdates.id, created.id), caller.uid);
    return NextResponse.json({ update: row });
  } catch (error) {
    return serverError(error, "Явцын мэдээлэл хадгалахад алдаа гарлаа");
  }
}
