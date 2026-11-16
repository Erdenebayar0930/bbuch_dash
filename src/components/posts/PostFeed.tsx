"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, UserCog } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import ImageViewer from "@/components/common/ImageViewer";
import CampaignApproversModal from "@/components/finance/CampaignApproversModal";
import PostAvatar from "@/components/posts/PostAvatar";
import PostCard from "@/components/posts/PostCard";
import PostComposer from "@/components/posts/PostComposer";
import type { PostBoard } from "@/data/postOptions";
import { isAdminRole } from "@/lib/permissions";
import {
  createPost,
  deletePost,
  listPosts,
  loadPostApprovers,
  reviewPost,
  savePostApprovers,
  updatePost,
  type Post,
  type PostInput,
} from "@/lib/posts";

const newestFirst = (a: Post, b: Post) => b.createdAt.getTime() - a.createdAt.getTime();

/**
 * Нүүр хуудасны нийтлэлийн самбар — Facebook-ийн пост шиг.
 *
 * Идэвхтэй гишүүн бүр бичнэ, өөрийнхөө нийтлэлийг засаж устгана. Админ
 * аль ч нийтлэлийг устгана (бусдын бичсэнийг засахгүй).
 *
 * Нийтлэл нь зөвшөөрөгч зөвшөөрсний дараа бүгдэд харагдана (@see
 * lib/api/postReview.ts). Зөвшөөрөгдөөгүй нийтлэл (`queue`) нь бичсэн хүн
 * болон зөвшөөрөгчдөд л дээд хэсэгт харагдана.
 */
export default function PostFeed({ board = "home" }: { board?: PostBoard }) {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);

  const [items, setItems] = useState<Post[]>([]);
  const [queue, setQueue] = useState<Post[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [approversOpen, setApproversOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await listPosts(board);
      setItems(page.posts);
      setHasMore(page.hasMore);
      setQueue(page.queue);
      setCanApprove(page.canApprove);
    } catch (err) {
      console.error("Нийтлэл ачаалж чадсангүй:", err);
      setError(err instanceof Error ? err.message : "Ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, [board]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    const last = items[items.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const page = await listPosts(board, last.createdAt);
      setItems((prev) => [
        ...prev,
        ...page.posts.filter((post) => !prev.some((item) => item.id === post.id)),
      ]);
      setHasMore(page.hasMore);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ачаалахад алдаа гарлаа.");
    } finally {
      setLoadingMore(false);
    }
  };

  /** Төлөвөөс нь хамаарч зөв жагсаалтад байрлуулна */
  const place = (post: Post) => {
    const others = (list: Post[]) => list.filter((item) => item.id !== post.id);
    if (post.status === "approved") {
      setQueue(others);
      setItems((prev) => [...others(prev), post].sort(newestFirst));
    } else {
      setItems(others);
      // Зөвшөөрөгч бусдын буцаасныг жагсаалтдаа үлдээхгүй
      const keep = post.status === "pending" || post.authorUid === user?.uid;
      setQueue((prev) => (keep ? [...others(prev), post].sort(newestFirst) : others(prev)));
    }
  };

  const publish = async (input: PostInput) => {
    if (!user?.uid) throw new Error("Нэвтэрсэн байх шаардлагатай.");
    place(await createPost(user.uid, board, input));
    return true;
  };

  const saveEdit = async (post: Post, input: PostInput) => {
    if (!user?.uid) throw new Error("Нэвтэрсэн байх шаардлагатай.");
    place(await updatePost(user.uid, post, input));
    setEditingId(null);
    return true;
  };

  const approve = async (post: Post) => place(await reviewPost(post.id, { action: "approve" }));
  const reject = async (post: Post, note: string) =>
    place(await reviewPost(post.id, { action: "reject", note }));

  const remove = async (post: Post) => {
    if (!window.confirm("Энэ нийтлэлийг устгах уу?")) return;
    try {
      await deletePost(post);
      setItems((prev) => prev.filter((item) => item.id !== post.id));
      setQueue((prev) => prev.filter((item) => item.id !== post.id));
    } catch (err) {
      console.error("Нийтлэл устгахад алдаа гарлаа:", err);
      window.alert(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    }
  };

  const renderPost = (post: Post) => {
    const own = !!user?.uid && post.authorUid === user.uid;

    return editingId === post.id ? (
      <div key={post.id} className="surface p-4">
        <PostComposer
          initialBody={post.body}
          initialVideoLink={post.videoLink}
          initialMedia={post.media}
          submitLabel="Хадгалах"
          onCancel={() => setEditingId(null)}
          onSubmit={(input) => saveEdit(post, input)}
        />
      </div>
    ) : (
      <PostCard
        key={post.id}
        post={post}
        canEdit={own}
        canDelete={own || isAdmin}
        onEdit={() => setEditingId(post.id)}
        onDelete={() => remove(post)}
        onOpenImage={setViewerSrc}
        onApprove={canApprove ? () => approve(post) : undefined}
        onReject={canApprove ? (note) => reject(post, note) : undefined}
      />
    );
  };

  const pendingCount = queue.filter((post) => post.status === "pending").length;
  const authorName =
    [user?.last_name, user?.first_name].filter(Boolean).join(" ") || user?.email || "";

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="surface flex gap-3 p-4">
        <PostAvatar name={authorName} photoUrl={user?.photoURL} />
        <div className="min-w-0 flex-1">
          <PostComposer submitLabel="Нийтлэх" onSubmit={publish} />
        </div>
      </div>

      {queue.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-theme-sm font-medium text-warning-600 dark:text-warning-400">
            {canApprove
              ? `Зөвшөөрөл хүлээж буй${pendingCount ? ` (${pendingCount})` : ""}`
              : "Таны зөвшөөрөгдөөгүй нийтлэл"}
          </p>
          {queue.map(renderPost)}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-theme-sm font-medium text-gray-500 dark:text-gray-400">Нийтлэлүүд</p>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setApproversOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-theme-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <UserCog className="h-4 w-4" strokeWidth={1.8} />
              Зөвшөөрөгчид
            </button>
          )}
          <button
            type="button"
            onClick={load}
            aria-label="Шинэчлэх"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      {loading && items.length === 0 && (
        <p className="py-8 text-center text-theme-sm text-gray-500">Ачаалж байна...</p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="surface px-4 py-10 text-center text-theme-sm text-gray-400">
          Одоогоор нийтлэл алга. Эхний нийтлэлээ дээрх хэсэгт бичээрэй.
        </p>
      )}

      {items.map(renderPost)}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mx-auto h-10 rounded-lg border border-gray-200 bg-white px-5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
        >
          {loadingMore ? "Ачаалж байна..." : "Цааш үзэх"}
        </button>
      )}

      <ImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />

      {isAdmin && (
        <CampaignApproversModal
          isOpen={approversOpen}
          onClose={() => {
            setApproversOpen(false);
            void load();
          }}
          title="Нийтлэл зөвшөөрөгчид"
          description="Сонгосон хүмүүс нүүр хуудас болон Санхүүгийн «…талаар» хэсгүүдэд оруулсан нийтлэлийг зөвшөөрөх эсвэл буцаана. Хэнийг ч сонгоогүй бол админ зөвшөөрнө."
          load={loadPostApprovers}
          save={savePostApprovers}
        />
      )}
    </section>
  );
}
