import "server-only";

import { and, asc, desc, eq, inArray, or, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";

import { forbidden, isAdminRole, requireActiveUser, type Caller } from "@/lib/api/auth";
import { involvesUser, taskVisibility } from "@/lib/api/planAccess";
import { db } from "@/lib/db";
import { projects, taskPollVotes, taskUpdates, tasks, users } from "@/lib/db/schema";
import { canWorkInAnyAimag } from "@/lib/permissions";

import type { NextRequest } from "next/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string) => UUID.test(value);

export const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/**
 * Төлөвлөгөөний даалгаврын явц/хуваарь руу хандах эрх.
 *
 * • Харах — даалгавар нь тухайн хүнд самбар дээр харагддаг бол
 *   (`taskVisibility`), эсвэл хариуцагч/хамтрагч бол.
 * • Бичих (явц, санал, хуваарь нэмэх) — харж чадаж байгаа хүн бүр: ажлын
 *   явцыг оролцогчид өөрсдөө тэмдэглэнэ.
 * • Хуваарь засах/устгах — тухайн аймгийн гишүүн, Харуул/админ, хариуцагч,
 *   хамтрагч (`canManage`).
 */
export async function requireTaskAccess(
  request: NextRequest,
  taskId: string
): Promise<{ error: NextResponse } | TaskAccess> {
  const result = await requireActiveUser(request);
  if (result.error) return { error: result.error };

  if (!isUuid(taskId)) return { error: notFound() } as const;

  const { caller } = result;
  const visibility = taskVisibility(caller.user);

  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      aimags: tasks.aimags,
      assignedTo: tasks.assignedTo,
      collaborators: tasks.collaborators,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(tasks.id, taskId),
        visibility ? or(visibility, involvesUser(caller.uid)) : undefined
      )
    )
    .limit(1);

  if (!task) return { error: notFound() } as const;

  const involved =
    task.assignedTo === caller.uid || (task.collaborators ?? []).includes(caller.uid);
  const canManage =
    involved || canWorkInAnyAimag(caller.user?.role, caller.user?.aimags, task.aimags ?? []);

  return {
    caller,
    task,
    canManage,
    isAdmin: isAdminRole(caller.user?.role),
  };
}

type TaskAccess = {
  caller: Caller;
  task: {
    id: string;
    title: string;
    aimags: string[];
    assignedTo: string | null;
    collaborators: string[];
  };
  canManage: boolean;
  isAdmin: boolean;
};

export const manageForbidden = () =>
  forbidden("Зөвхөн тухайн аймгийн гишүүн, хариуцагч эсвэл хамтрагч өөрчилнө.");

/** Санал асуулгын хязгаар */
export const MAX_POLL_OPTIONS = 10;
const MAX_POLL_TEXT = 200;

export type Poll = { question: string; options: { id: string; text: string }[]; multi: boolean };

/**
 * Санал асуулгыг шалгана. `undefined`/`null` → санал асуулгагүй.
 * Хамгийн багадаа 2 сонголт; сонголтын id-г сервер өгнө (o1, o2 …).
 */
export function readPoll(input: unknown): { ok: true; value: Poll | null } | { ok: false; error: string } {
  if (input === undefined || input === null) return { ok: true, value: null };
  if (typeof input !== "object") return { ok: false, error: "Санал асуулга буруу байна." };

  const raw = input as Record<string, unknown>;
  const clean = (value: unknown) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, MAX_POLL_TEXT) : "";

  const question = clean(raw.question);
  const texts = (Array.isArray(raw.options) ? raw.options : []).map(clean).filter(Boolean);

  if (!question) return { ok: false, error: "Санал асуулгын асуултыг бичнэ үү." };
  if (texts.length < 2) return { ok: false, error: "Санал асуулгад дор хаяж 2 сонголт байна." };
  if (texts.length > MAX_POLL_OPTIONS) {
    return { ok: false, error: `Хамгийн ихдээ ${MAX_POLL_OPTIONS} сонголт.` };
  }

  return {
    ok: true,
    value: {
      question,
      options: texts.map((text, index) => ({ id: `o${index + 1}`, text })),
      multi: raw.multi === true,
    },
  };
}

/** YYYY-MM-DD бодит огноо эсэх */
export const isRealDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDate() === d && y >= 2000 && y <= 2100;
};

const updateColumns = {
  id: taskUpdates.id,
  taskId: taskUpdates.taskId,
  authorUid: taskUpdates.authorUid,
  authorFirstName: users.firstName,
  authorLastName: users.lastName,
  authorPhotoUrl: users.photoUrl,
  body: taskUpdates.body,
  media: taskUpdates.media,
  videoLink: taskUpdates.videoLink,
  period: taskUpdates.period,
  poll: taskUpdates.poll,
  createdAt: taskUpdates.createdAt,
  updatedAt: taskUpdates.updatedAt,
} as const;

/**
 * Явцын мэдээллийг санал асуулгын дүнтэй нь уншина — сонголт бүрийн санал
 * өгсөн хүмүүсийн нэр, миний сонголт. Саналыг нэг query-гээр татна.
 */
export async function readUpdateRows(where: SQL | undefined, me: string) {
  const rows = await db
    .select(updateColumns)
    .from(taskUpdates)
    .leftJoin(users, eq(taskUpdates.authorUid, users.uid))
    .where(where)
    .orderBy(desc(taskUpdates.period), desc(taskUpdates.createdAt));

  const ids = rows.map((row) => row.id);
  const votes =
    ids.length > 0
      ? await db
          .select({
            updateId: taskPollVotes.updateId,
            uid: taskPollVotes.uid,
            optionId: taskPollVotes.optionId,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(taskPollVotes)
          .leftJoin(users, eq(taskPollVotes.uid, users.uid))
          .where(inArray(taskPollVotes.updateId, ids))
          .orderBy(asc(taskPollVotes.createdAt))
      : [];

  return rows.map((row) => {
    const own = votes.filter((vote) => vote.updateId === row.id);
    const voters: Record<string, string[]> = {};
    for (const vote of own) {
      const name = [vote.lastName, vote.firstName].filter(Boolean).join(" ") || "Нэргүй";
      (voters[vote.optionId] ??= []).push(name);
    }
    return {
      ...row,
      voters,
      myVotes: own.filter((vote) => vote.uid === me).map((vote) => vote.optionId),
    };
  });
}
