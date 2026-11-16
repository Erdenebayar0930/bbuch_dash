"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Link2, Video, X } from "lucide-react";

import {
  MAX_POST_IMAGE_BYTES,
  MAX_POST_LENGTH,
  MAX_POST_LINK_LENGTH,
  MAX_POST_MEDIA,
  MAX_POST_VIDEO_BYTES,
  parseVideoLink,
} from "@/data/postOptions";
import type { PostInput, PostMedia } from "@/lib/posts";

type PostComposerProps = {
  initialBody?: string;
  initialVideoLink?: string;
  initialMedia?: PostMedia[];
  submitLabel: string;
  /** Засвар үед «Болих» товч гаргана */
  onCancel?: () => void;
  /** Амжилттай бол true — маягт цэвэрлэгдэнэ */
  onSubmit: (input: PostInput) => Promise<boolean>;
};

const fieldClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const toolClass =
  "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-theme-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-white/5";

/** Нийтлэл бичих / засах хэсэг — бичвэр, зураг, видео файл, видео холбоос. */
export default function PostComposer({
  initialBody = "",
  initialVideoLink = "",
  initialMedia = [],
  submitLabel,
  onCancel,
  onSubmit,
}: PostComposerProps) {
  const [body, setBody] = useState(initialBody);
  const [videoLink, setVideoLink] = useState(initialVideoLink);
  const [showLink, setShowLink] = useState(!!initialVideoLink);
  const [keep, setKeep] = useState<PostMedia[]>(initialMedia);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 480)}px`;
  }, [body]);

  const total = keep.length + files.length;
  const linkTrimmed = videoLink.trim();
  const linkInvalid = linkTrimmed.length > 0 && !parseVideoLink(linkTrimmed);

  const pickFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.length === 0) return;

    const valid = picked.filter((file) =>
      file.type.startsWith("image/")
        ? file.size <= MAX_POST_IMAGE_BYTES
        : file.type.startsWith("video/") && file.size <= MAX_POST_VIDEO_BYTES
    );
    const room = MAX_POST_MEDIA - total;

    if (valid.length < picked.length) {
      setError("Зураг 10MB, видео 100MB хүртэл байна.");
    } else if (valid.length > room) {
      setError(`Хамгийн ихдээ ${MAX_POST_MEDIA} файл оруулна.`);
    } else {
      setError(null);
    }

    setFiles((prev) => [...prev, ...valid.slice(0, Math.max(0, room))]);
  };

  const canSubmit =
    !busy && !linkInvalid && (body.trim().length > 0 || total > 0 || linkTrimmed.length > 0);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);
    setProgress(files.length > 0 ? 0 : null);

    try {
      const ok = await onSubmit({
        body: body.trim(),
        videoLink: linkTrimmed,
        keep,
        files,
        onProgress: setProgress,
      });
      if (ok && !onCancel) {
        setBody("");
        setVideoLink("");
        setShowLink(false);
        setKeep([]);
        setFiles([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Нийтлэхэд алдаа гарлаа.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const thumbs = [
    ...keep.map((item) => ({
      key: item.path,
      src: item.url,
      video: item.kind === "video",
      remove: () => setKeep((prev) => prev.filter((other) => other.path !== item.path)),
    })),
    ...files.map((file, index) => ({
      key: `${file.name}-${index}`,
      src: previews[index],
      video: file.type.startsWith("video/"),
      remove: () => setFiles((prev) => prev.filter((_, i) => i !== index)),
    })),
  ];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <textarea
        ref={textarea}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Юу хуваалцах вэ?"
        maxLength={MAX_POST_LENGTH}
        rows={3}
        className={`${fieldClass} min-h-[88px] resize-none py-3 leading-relaxed`}
      />

      {showLink && (
        <div className="flex flex-col gap-1">
          <input
            type="url"
            value={videoLink}
            onChange={(event) => setVideoLink(event.target.value)}
            placeholder="YouTube эсвэл Facebook видеоны холбоос"
            maxLength={MAX_POST_LINK_LENGTH}
            className={`${fieldClass} h-10`}
          />
          {linkInvalid && (
            <span className="text-theme-xs text-error-600 dark:text-error-400">
              Зөвхөн YouTube эсвэл Facebook видеоны холбоос оруулна.
            </span>
          )}
        </div>
      )}

      {thumbs.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {thumbs.map((thumb) => (
            <li key={thumb.key} className="relative">
              {thumb.video ? (
                <video
                  src={thumb.src}
                  muted
                  preload="metadata"
                  className="h-20 w-20 rounded-lg border border-gray-200 bg-black object-cover dark:border-white/10"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element -- Storage/түр blob URL */
                <img
                  src={thumb.src}
                  alt=""
                  className="h-20 w-20 rounded-lg border border-gray-200 object-cover dark:border-white/10"
                />
              )}
              {thumb.video && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <Video className="h-6 w-6 text-white drop-shadow" strokeWidth={1.8} />
                </span>
              )}
              <button
                type="button"
                onClick={thumb.remove}
                disabled={busy}
                aria-label="Файлыг хасах"
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900/80 text-white transition-colors hover:bg-gray-900"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {progress !== null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
          <div
            className="h-full bg-accent-500 transition-[width]"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-2.5 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1 border-t border-gray-100 pt-3 dark:border-white/5">
        <input ref={imageInput} type="file" accept="image/*" multiple onChange={pickFiles} className="hidden" />
        <input ref={videoInput} type="file" accept="video/*" multiple onChange={pickFiles} className="hidden" />
        <button
          type="button"
          onClick={() => imageInput.current?.click()}
          disabled={busy || total >= MAX_POST_MEDIA}
          className={toolClass}
        >
          <ImagePlus className="h-5 w-5 text-success-600 dark:text-success-400" strokeWidth={1.8} />
          Зураг
        </button>
        <button
          type="button"
          onClick={() => videoInput.current?.click()}
          disabled={busy || total >= MAX_POST_MEDIA}
          className={toolClass}
        >
          <Video className="h-5 w-5 text-error-500" strokeWidth={1.8} />
          Бичлэг
        </button>
        <button
          type="button"
          onClick={() => setShowLink((open) => !open)}
          disabled={busy}
          aria-pressed={showLink}
          className={toolClass}
        >
          <Link2 className="h-5 w-5 text-accent-600 dark:text-accent-400" strokeWidth={1.8} />
          Холбоос
        </button>
        {total > 0 && (
          <span className="text-theme-xs text-gray-400">
            {total}/{MAX_POST_MEDIA}
          </span>
        )}

        <div className="ml-auto flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="h-9 rounded-lg border border-gray-200 bg-white px-4 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
            >
              Болих
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="h-9 rounded-lg bg-accent-600 px-5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? progress !== null
                ? `Байршуулж байна ${Math.round(progress * 100)}%`
                : "Түр хүлээнэ үү..."
              : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
