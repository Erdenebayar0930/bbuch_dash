"use client";

import type { FeedbackStatus } from "@/data/feedbackOptions";

import { apiFetch } from "./apiClient";

export type FeedbackImage = { url: string; path: string };

export type FeedbackReply = {
  /** Хариу бичих үеийн админы асуулт */
  question: string;
  text: string;
  at: Date;
};

export type Feedback = {
  id: string;
  authorUid: string | null;
  authorName: string;
  authorPhotoUrl: string;
  title: string;
  body: string;
  images: FeedbackImage[];
  status: FeedbackStatus;
  adminNote: string;
  replies: FeedbackReply[];
  statusUpdatedAt: Date | null;
  createdAt: Date;
};

type FeedbackRow = {
  id: string;
  authorUid: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorPhotoUrl: string | null;
  title: string;
  body: string | null;
  images: FeedbackImage[] | null;
  status: FeedbackStatus;
  adminNote: string | null;
  replies: { question: string; text: string; at: string }[] | null;
  statusUpdatedAt: string | null;
  createdAt: string;
};

const toFeedback = (row: FeedbackRow): Feedback => ({
  id: row.id,
  authorUid: row.authorUid,
  authorName:
    [row.authorFirstName, row.authorLastName].filter(Boolean).join(" ") ||
    "Нэргүй хэрэглэгч",
  authorPhotoUrl: row.authorPhotoUrl ?? "",
  title: row.title,
  body: row.body ?? "",
  images: row.images ?? [],
  status: row.status,
  adminNote: row.adminNote ?? "",
  replies: (row.replies ?? []).map((reply) => ({
    question: reply.question ?? "",
    text: reply.text,
    at: new Date(reply.at),
  })),
  statusUpdatedAt: row.statusUpdatedAt ? new Date(row.statusUpdatedAt) : null,
  createdAt: new Date(row.createdAt),
});

/** Бүх санал хүсэлт — шинэ нь эхэндээ. */
export async function listFeedback(): Promise<Feedback[]> {
  const data = await apiFetch<{ feedback: FeedbackRow[] }>("/api/feedback");
  return (data.feedback ?? []).map(toFeedback);
}

/**
 * Санал хүсэлт илгээнэ — зургийг эхлээд Storage-д байршуулна. Бүртгэл
 * бүтэлгүйтвэл байршуулсан зургуудыг буцааж устгана (эзэнгүй файл үлдэхгүй).
 */
export async function createFeedback(
  uid: string,
  input: { title: string; body: string; files: File[] }
): Promise<Feedback> {
  const { uploadFeedbackImage, deleteFeedbackImage } = await import("./storage");
  const images: FeedbackImage[] = [];

  try {
    for (const file of input.files) {
      images.push(await uploadFeedbackImage(uid, file));
    }

    const data = await apiFetch<{ feedback: FeedbackRow }>("/api/feedback", {
      method: "POST",
      body: { title: input.title, body: input.body, images },
    });
    return toFeedback(data.feedback);
  } catch (error) {
    await Promise.all(
      images.map((image) => deleteFeedbackImage(image.path).catch(() => {}))
    );
    throw error;
  }
}

/**
 * "Нэмэлт тайлбар" асуултад хариу бичнэ — зөвхөн бичсэн хүн. Төлөв нь
 * "Хүлээгдэж байгаа" руу буцаж, админ дахин хянана.
 */
export async function replyToFeedback(
  id: string,
  text: string
): Promise<Feedback> {
  const data = await apiFetch<{ feedback: FeedbackRow }>(
    `/api/feedback/${id}/reply`,
    { method: "POST", body: { text } }
  );
  return toFeedback(data.feedback);
}

/** Явцыг шинэчилнэ (зөвхөн админ). */
export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
  adminNote: string
): Promise<Feedback> {
  const data = await apiFetch<{ feedback: FeedbackRow }>(
    `/api/feedback/${id}`,
    { method: "PATCH", body: { status, adminNote } }
  );
  return toFeedback(data.feedback);
}

/** Устгана (зөвхөн админ) — зургийн файлуудыг ч цэвэрлэнэ. */
export async function deleteFeedback(id: string): Promise<void> {
  const data = await apiFetch<{ ok: boolean; imagePaths: string[] }>(
    `/api/feedback/${id}`,
    { method: "DELETE" }
  );

  const { deleteFeedbackImage } = await import("./storage");
  await Promise.all(
    (data.imagePaths ?? []).map((path) =>
      deleteFeedbackImage(path).catch(() => {})
    )
  );
}
