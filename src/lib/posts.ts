"use client";

import type { PostBoard, PostTag } from "@/data/postOptions";

export type { PostTag };

import { apiFetch } from "./apiClient";

/** `file` — хавсралт баримт (PDF, Word, Excel); `name`, `size` нь түүнд л байна */
export type PostMedia = {
  kind: "image" | "video" | "file";
  url: string;
  path: string;
  name?: string;
  size?: number;
};

export type Post = {
  id: string;
  authorUid: string | null;
  authorName: string;
  authorPhotoUrl: string;
  body: string;
  media: PostMedia[];
  videoLink: string;
  /** Цохсон нэрс — нэр цохож болдог самбарт л (@see TAGGABLE_BOARDS) */
  tags: PostTag[];
  /** `YYYY-MM-DD` — аль өдрийн мэдээлэл вэ, хоосон бол нийтэлсэн огноо */
  period: string;
  /** pending — зөвшөөрөл хүлээж буй, approved — бүгдэд, rejected — буцаасан */
  status: "pending" | "approved" | "rejected";
  /** Буцаасан шалтгаан */
  reviewNote: string;
  createdAt: Date;
  /** Засагдсан бол — `createdAt`-аас ялгаатай */
  edited: boolean;
};

type PostRow = {
  id: string;
  authorUid: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorPhotoUrl: string | null;
  body: string | null;
  media: PostMedia[] | null;
  videoLink: string | null;
  tags?: PostTag[] | null;
  period: string | null;
  status: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PostInput = {
  body: string;
  videoLink: string;
  /** `YYYY-MM-DD` — хоосон бол одоо */
  period: string;
  /** Цохсон нэрс — нэр цохдоггүй самбарт хоосон */
  tags: PostTag[];
  /** Засварт үлдээх хуучин файлууд */
  keep: PostMedia[];
  files: File[];
  /** Байршуулалтын нийт явц 0–1 */
  onProgress?: (fraction: number) => void;
};

const toPost = (row: PostRow): Post => {
  const createdAt = new Date(row.createdAt);
  const updatedAt = new Date(row.updatedAt);

  return {
    id: row.id,
    authorUid: row.authorUid,
    authorName:
      [row.authorLastName, row.authorFirstName].filter(Boolean).join(" ") || "Нэргүй хэрэглэгч",
    authorPhotoUrl: row.authorPhotoUrl ?? "",
    body: row.body ?? "",
    media: row.media ?? [],
    videoLink: row.videoLink ?? "",
    tags: row.tags ?? [],
    period: row.period ?? "",
    status: row.status === "approved" || row.status === "rejected" ? row.status : "pending",
    reviewNote: row.reviewNote ?? "",
    createdAt,
    edited: updatedAt.getTime() - createdAt.getTime() > 60_000,
  };
};

export type PostPage = {
  /** Зөвшөөрөгдсөн нийтлэлүүд */
  posts: Post[];
  hasMore: boolean;
  /** Зөвшөөрөгдөөгүй — зөвшөөрөгчид бүгд, бусдад өөрийнх (эхний хуудсанд л) */
  queue: Post[];
  canApprove: boolean;
};

export async function listPosts(board: PostBoard, before?: Date): Promise<PostPage> {
  const params = new URLSearchParams({ board });
  if (before) params.set("before", before.toISOString());
  const query = `?${params.toString()}`;
  const data = await apiFetch<{
    posts: PostRow[];
    hasMore: boolean;
    queue?: PostRow[];
    canApprove?: boolean;
  }>(`/api/posts${query}`);
  return {
    posts: data.posts.map(toPost),
    hasMore: data.hasMore,
    queue: (data.queue ?? []).map(toPost),
    canApprove: data.canApprove ?? false,
  };
}

/** Нийтлэлийг зөвшөөрөх / буцаах — зөвхөн зөвшөөрөгч */
export async function reviewPost(
  id: string,
  review: { action: "approve" } | { action: "reject"; note: string }
): Promise<Post> {
  const data = await apiFetch<{ post: PostRow }>(`/api/posts/${id}/review`, {
    method: "POST",
    body: review,
  });
  return toPost(data.post);
}

/** Нийтлэл зөвшөөрөх эрхтэй хүмүүс — зөвхөн админ */
export async function loadPostApprovers(): Promise<string[]> {
  const data = await apiFetch<{ uids: string[] }>("/api/posts/approvers");
  return data.uids;
}

export async function savePostApprovers(uids: string[]): Promise<string[]> {
  const data = await apiFetch<{ uids: string[] }>("/api/posts/approvers", {
    method: "PUT",
    body: { uids },
  });
  return data.uids;
}

/** Файлуудыг дараалан байршуулж, нийт явцыг (байтаар жинлэж) мэдээлнэ. */
export async function uploadAll(uid: string, files: File[], onProgress?: (fraction: number) => void) {
  const { uploadPostMedia } = await import("./storage");
  const total = files.reduce((sum, file) => sum + file.size, 0) || 1;
  let done = 0;
  const uploaded: PostMedia[] = [];

  try {
    for (const file of files) {
      uploaded.push(
        await uploadPostMedia(uid, file, (fraction) =>
          onProgress?.((done + fraction * file.size) / total)
        )
      );
      done += file.size;
    }
    return uploaded;
  } catch (error) {
    await removeFiles(uploaded);
    throw error;
  }
}

export async function removeFiles(media: PostMedia[]) {
  if (media.length === 0) return;
  const { deletePostMedia } = await import("./storage");
  await Promise.all(media.map((item) => deletePostMedia(item.path)));
}

/** Нийтлэл үүсгэнэ — хадгалагдаагүй бол байршуулсан файлуудыг буцааж устгана. */
export async function createPost(uid: string, board: PostBoard, input: PostInput): Promise<Post> {
  const uploaded = await uploadAll(uid, input.files, input.onProgress);

  try {
    const data = await apiFetch<{ post: PostRow }>(`/api/posts?board=${board}`, {
      method: "POST",
      body: {
        body: input.body,
        videoLink: input.videoLink,
        period: input.period,
        tags: input.tags,
        media: uploaded,
      },
    });
    return toPost(data.post);
  } catch (error) {
    await removeFiles(uploaded);
    throw error;
  }
}

/** Нийтлэлийг засна. Хадгалагдсаны дараа хасагдсан хуучин файлуудыг цэвэрлэнэ. */
export async function updatePost(uid: string, post: Post, input: PostInput): Promise<Post> {
  const uploaded = await uploadAll(uid, input.files, input.onProgress);

  try {
    const data = await apiFetch<{ post: PostRow }>(`/api/posts/${post.id}`, {
      method: "PATCH",
      body: {
        body: input.body,
        videoLink: input.videoLink,
        period: input.period,
        tags: input.tags,
        media: [...input.keep, ...uploaded],
      },
    });

    const kept = new Set(input.keep.map((item) => item.path));
    void removeFiles(post.media.filter((item) => !kept.has(item.path)));

    return toPost(data.post);
  } catch (error) {
    await removeFiles(uploaded);
    throw error;
  }
}

/** Нийтлэлийг устгаад файлуудыг нь цэвэрлэнэ. */
export async function deletePost(post: Post): Promise<void> {
  await apiFetch(`/api/posts/${post.id}`, { method: "DELETE" });
  void removeFiles(post.media);
}
