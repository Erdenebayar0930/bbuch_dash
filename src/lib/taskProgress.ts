"use client";

import { apiFetch } from "./apiClient";
import { removeFiles, uploadAll, type Post, type PostInput, type PostMedia } from "./posts";

/** Санал асуулга — сонголтын id-г сервер өгнө */
export type Poll = { question: string; options: { id: string; text: string }[]; multi: boolean };

/** Нэг явцын мэдээлэл — нийтлэлийн хэлбэртэй, санал асуулгатай байж болно */
export type TaskUpdate = {
  id: string;
  authorUid: string | null;
  authorName: string;
  authorPhotoUrl: string;
  body: string;
  media: PostMedia[];
  videoLink: string;
  /** YYYY-MM-DD — календарьт энэ өдөрт гарна */
  period: string;
  poll: Poll | null;
  /** Сонголт бүрийн санал өгсөн хүмүүсийн нэр */
  voters: Record<string, string[]>;
  myVotes: string[];
  createdAt: Date;
  edited: boolean;
};

type UpdateRow = {
  id: string;
  authorUid: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorPhotoUrl: string | null;
  body: string | null;
  media: PostMedia[] | null;
  videoLink: string | null;
  period: string | null;
  poll: Poll | null;
  voters?: Record<string, string[]>;
  myVotes?: string[];
  createdAt: string;
  updatedAt: string;
};

const toUpdate = (row: UpdateRow): TaskUpdate => {
  const createdAt = new Date(row.createdAt);
  return {
    id: row.id,
    authorUid: row.authorUid,
    authorName:
      [row.authorLastName, row.authorFirstName].filter(Boolean).join(" ") || "Нэргүй хэрэглэгч",
    authorPhotoUrl: row.authorPhotoUrl ?? "",
    body: row.body ?? "",
    media: row.media ?? [],
    videoLink: row.videoLink ?? "",
    period: row.period ?? "",
    poll: row.poll ?? null,
    voters: row.voters ?? {},
    myVotes: row.myVotes ?? [],
    createdAt,
    edited: new Date(row.updatedAt).getTime() - createdAt.getTime() > 60_000,
  };
};

/** PostCard-аар харуулахын тулд нийтлэлийн хэлбэрт хөрвүүлнэ */
export const asPost = (update: TaskUpdate): Post => ({
  id: update.id,
  authorUid: update.authorUid,
  authorName: update.authorName,
  authorPhotoUrl: update.authorPhotoUrl,
  body: update.body,
  media: update.media,
  videoLink: update.videoLink,
  tags: [],
  period: update.period,
  status: "approved",
  reviewNote: "",
  createdAt: update.createdAt,
  edited: update.edited,
});

const base = (taskId: string) => `/api/tasks/${encodeURIComponent(taskId)}`;

export async function listTaskUpdates(
  taskId: string
): Promise<{ updates: TaskUpdate[]; canManage: boolean }> {
  const data = await apiFetch<{ updates: UpdateRow[]; canManage?: boolean }>(`${base(taskId)}/updates`);
  return { updates: data.updates.map(toUpdate), canManage: data.canManage ?? false };
}

/** Явц нэмнэ — файлыг эхлээд байршуулж, хадгалагдаагүй бол буцааж устгана. */
export async function createTaskUpdate(
  uid: string,
  taskId: string,
  input: PostInput & { poll: { question: string; options: string[]; multi: boolean } | null }
): Promise<TaskUpdate> {
  const uploaded = await uploadAll(uid, input.files, input.onProgress);
  try {
    const data = await apiFetch<{ update: UpdateRow }>(`${base(taskId)}/updates`, {
      method: "POST",
      body: {
        body: input.body,
        videoLink: input.videoLink,
        period: input.period,
        media: uploaded,
        poll: input.poll,
      },
    });
    return toUpdate(data.update);
  } catch (error) {
    await removeFiles(uploaded);
    throw error;
  }
}

export async function deleteTaskUpdate(taskId: string, update: TaskUpdate): Promise<void> {
  await apiFetch(`${base(taskId)}/updates/${update.id}`, { method: "DELETE" });
  void removeFiles(update.media);
}

export async function voteTaskPoll(taskId: string, updateId: string, optionIds: string[]): Promise<TaskUpdate> {
  const data = await apiFetch<{ update: UpdateRow }>(`${base(taskId)}/updates/${updateId}/vote`, {
    method: "POST",
    body: { optionIds },
  });
  return toUpdate(data.update);
}

/** Хуваарийн нэг үе шат */
export type ScheduleItem = {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  note: string;
  done: boolean;
};

type ScheduleRow = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  note: string | null;
  doneAt: string | null;
};

const toItem = (row: ScheduleRow): ScheduleItem => ({
  id: row.id,
  title: row.title,
  startDate: row.startDate,
  endDate: row.endDate || row.startDate,
  note: row.note ?? "",
  done: !!row.doneAt,
});

export async function listSchedule(taskId: string): Promise<{ items: ScheduleItem[]; canManage: boolean }> {
  const data = await apiFetch<{ items: ScheduleRow[]; canManage?: boolean }>(`${base(taskId)}/schedule`);
  return { items: data.items.map(toItem), canManage: data.canManage ?? false };
}

export async function addScheduleItem(
  taskId: string,
  input: { title: string; startDate: string; endDate: string; note: string }
): Promise<ScheduleItem> {
  const data = await apiFetch<{ item: ScheduleRow }>(`${base(taskId)}/schedule`, {
    method: "POST",
    body: input,
  });
  return toItem(data.item);
}

export async function setScheduleDone(taskId: string, itemId: string, done: boolean): Promise<ScheduleItem> {
  const data = await apiFetch<{ item: ScheduleRow }>(`${base(taskId)}/schedule/${itemId}`, {
    method: "PATCH",
    body: { done },
  });
  return toItem(data.item);
}

export async function deleteScheduleItem(taskId: string, itemId: string): Promise<void> {
  await apiFetch(`${base(taskId)}/schedule/${itemId}`, { method: "DELETE" });
}

/** 7 хоногийн календарийн үе шат — аль даалгаврынх болохыг заана */
export type WeekScheduleItem = ScheduleItem & { taskId: string };

/** Хугацаанд давхцах бүх үе шат (харагдах даалгавруудынх). */
export async function listScheduleRange(from: string, to: string): Promise<WeekScheduleItem[]> {
  const params = new URLSearchParams({ from, to });
  const data = await apiFetch<{ items: (ScheduleRow & { taskId: string })[] }>(
    `/api/tasks/schedule?${params.toString()}`
  );
  return data.items.map((row) => ({ ...toItem({ ...row, note: row.note ?? "" }), taskId: row.taskId }));
}
