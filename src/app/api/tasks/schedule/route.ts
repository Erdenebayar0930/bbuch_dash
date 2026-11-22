import { and, asc, eq, gte, lte, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireActiveUser, serverError } from "@/lib/api/auth";
import { involvesUser, taskVisibility } from "@/lib/api/planAccess";
import { isRealDate } from "@/lib/api/taskProgress";
import { db } from "@/lib/db";
import { projects, taskScheduleItems, tasks } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Хугацааны хуваарь — `?from=YYYY-MM-DD&to=YYYY-MM-DD` хооронд үргэлжлэх
 * бүх төлөвлөгөөний үе шат (Төлөвлөгөөний 7 хоногийн календарьт).
 * Хэрэглэгчид самбар дээр харагддаг даалгавруудынх л буцна.
 */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!isRealDate(from) || !isRealDate(to) || to < from) {
    return badRequest("Огноог YYYY-MM-DD хэлбэрээр оруулна уу.");
  }

  const { caller } = result;
  const visibility = taskVisibility(caller.user);

  try {
    const items = await db
      .select({
        id: taskScheduleItems.id,
        taskId: taskScheduleItems.taskId,
        title: taskScheduleItems.title,
        startDate: taskScheduleItems.startDate,
        endDate: taskScheduleItems.endDate,
        doneAt: taskScheduleItems.doneAt,
      })
      .from(taskScheduleItems)
      .innerJoin(tasks, eq(taskScheduleItems.taskId, tasks.id))
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          // Хугацаа давхцах: эхэлсэн нь `to`-оос өмнө, дууссан нь `from`-оос хойно
          lte(taskScheduleItems.startDate, to),
          gte(taskScheduleItems.endDate, from),
          visibility ? or(visibility, involvesUser(caller.uid)) : undefined
        )
      )
      .orderBy(asc(taskScheduleItems.startDate));

    return NextResponse.json({ items });
  } catch (error) {
    return serverError(error, "Хуваарь уншихад алдаа гарлаа");
  }
}
