"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Clock, MoreHorizontal, Pencil, Trash2, Undo2 } from "lucide-react";

import PostAvatar from "@/components/posts/PostAvatar";
import { formatPostTime, parseVideoLink } from "@/data/postOptions";
import type { Post } from "@/lib/posts";

type PostCardProps = {
  post: Post;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onOpenImage: (src: string) => void;
  /** Зөвшөөрөгчид — хүлээгдэж буй нийтлэл дээр «Зөвшөөрөх / Буцаах» */
  onApprove?: () => Promise<void>;
  onReject?: (note: string) => Promise<void>;
};

/** Үүнээс урт бичвэрийг эхлээд хураангуйлж «Цааш унших» гаргана */
const COLLAPSE_AT = 220;

/** Нийтлэлийн карт — сайтын мэдээний карт шиг: дээр нь зураг/бичлэг, доор нь бичсэн хүн ба бичвэр. */
export default function PostCard({
  post,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onOpenImage,
  onApprove,
  onReject,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const review = async (run: () => Promise<void>) => {
    setReviewing(true);
    try {
      await run();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setReviewing(false);
    }
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const { body } = post;
  const long = body.length > COLLAPSE_AT;
  const shownBody = long && !expanded ? `${body.slice(0, COLLAPSE_AT).trimEnd()}…` : body;
  const images = post.media.filter((item) => item.kind === "image").map((item) => item.url);
  const videos = post.media.filter((item) => item.kind === "video");
  const embed = post.videoLink ? parseVideoLink(post.videoLink) : null;

  return (
    <article className="surface flex h-full flex-col overflow-hidden">
      {post.status === "pending" && (
        <p className="flex items-center gap-2 bg-warning-50 px-4 py-2 text-theme-xs font-medium text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
          <Clock className="h-3.5 w-3.5" strokeWidth={2} />
          Зөвшөөрөл хүлээж байна — зөвшөөрөгдсөний дараа бүгдэд харагдана
        </p>
      )}
      {post.status === "rejected" && (
        <p className="bg-error-50 px-4 py-2 text-theme-xs text-error-700 dark:bg-error-500/10 dark:text-error-400">
          <span className="font-medium">Буцаасан.</span>
          {post.reviewNote ? ` ${post.reviewNote}` : " Засаад дахин илгээнэ үү."}
        </p>
      )}
      {(embed || videos.length > 0 || images.length > 0) && (
        <div className="flex flex-col gap-0.5">
          {embed && (
            <div className="relative aspect-video w-full bg-black">
              <iframe
                src={embed.embedUrl}
                title="Видео"
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
          )}

          {videos.map((video) => (
            <video
              key={video.path}
              src={video.url}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full bg-black object-contain"
            />
          ))}

          {images.length > 0 && <ImageGrid images={images} onOpen={onOpenImage} />}
        </div>
      )}

      <header className="flex items-center gap-3 px-4 pt-4">
        <PostAvatar name={post.authorName} photoUrl={post.authorPhotoUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            {post.authorName}
          </p>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {formatPostTime(post.createdAt)}
            {post.edited && " · Засагдсан"}
          </p>
        </div>

        {(canEdit || canDelete) && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Нийтлэлийн үйлдэл"
              aria-expanded={menuOpen}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
            >
              <MoreHorizontal className="h-5 w-5" strokeWidth={1.8} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-10 z-10 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-gray-900">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-theme-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={1.8} />
                    Засах
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-theme-sm text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                    Устгах
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {body && (
        <div className="px-4 pt-3">
          <p className="whitespace-pre-line break-words text-theme-sm leading-relaxed text-gray-800 dark:text-white/90">
            {shownBody}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              className="mt-1 text-theme-sm font-medium text-gray-500 hover:underline dark:text-gray-400"
            >
              {expanded ? "Хураах" : "Цааш унших"}
            </button>
          )}
        </div>
      )}

      {post.status === "pending" && onApprove && onReject && (
        <div className="border-t border-gray-100 px-4 py-3 dark:border-white/5">
          {rejecting ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Буцаах шалтгаан (заавал биш)"
                maxLength={2000}
                rows={2}
                className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejecting(false)}
                  disabled={reviewing}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-4 text-theme-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={() => review(() => onReject(note.trim()))}
                  disabled={reviewing}
                  className="h-9 rounded-lg bg-error-600 px-4 text-theme-sm font-medium text-white hover:bg-error-700 disabled:opacity-50"
                >
                  Буцаах
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejecting(true)}
                disabled={reviewing}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 text-theme-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
              >
                <Undo2 className="h-4 w-4" strokeWidth={1.8} />
                Буцаах
              </button>
              <button
                type="button"
                onClick={() => review(onApprove)}
                disabled={reviewing}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-success-600 px-4 text-theme-sm font-medium text-white hover:bg-success-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4" strokeWidth={2} />
                Зөвшөөрөх
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 pb-4" />
    </article>
  );
}

/** Зургийн тор (16:9 хүрээнд): 1 → бүтэн, 2 → хоёр багана, 3 → нэг том + хоёр, 4+ → 2×2 ба «+N». */
function ImageGrid({ images, onOpen }: { images: string[]; onOpen: (src: string) => void }) {
  const shown = images.slice(0, 4);
  const extra = images.length - shown.length;

  const cell = (index: number) => {
    if (shown.length === 1) return "col-span-2 row-span-2";
    if (shown.length === 2) return "row-span-2";
    if (shown.length === 3 && index === 0) return "row-span-2";
    return "";
  };

  return (
    <div className="grid aspect-video grid-cols-2 grid-rows-2 gap-0.5 bg-gray-100 dark:bg-white/5">
      {shown.map((src, index) => (
        <button
          key={`${src}-${index}`}
          type="button"
          onClick={() => onOpen(src)}
          aria-label={`Зураг ${index + 1}-ийг томоор харах`}
          className={`relative block overflow-hidden ${cell(index)}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Firebase Storage URL */}
          <img
            src={src}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
          />
          {extra > 0 && index === shown.length - 1 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-semibold text-white">
              +{extra}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
