"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, FileText, ImagePlus, Link2, Paperclip, Video, X } from "lucide-react";

import {
  MAX_POST_FILE_BYTES,
  MAX_POST_IMAGE_BYTES,
  MAX_POST_LENGTH,
  MAX_POST_LINK_LENGTH,
  MAX_POST_MEDIA,
  MAX_POST_VIDEO_BYTES,
  POST_FILE_ACCEPT,
  POST_FILE_TYPES,
  POST_PERIOD_MIN_YEAR,
  formatFileSize,
  todayKey,
  parseVideoLink,
} from "@/data/postOptions";
import type { PostInput, PostMedia } from "@/lib/posts";

/** Зарим утас/хөтөч Office файлын төрлийг хоосон өгдөг — өргөтгөлөөр нь нөхнө */
const TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function withKnownType(file: File): File {
  if (file.type) return file;
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? "";
  const type = TYPE_BY_EXTENSION[ext];
  return type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file;
}

const isDocument = (file: File) => POST_FILE_TYPES.includes(file.type);

/** Хавсралтын тэмдэг дээрх товч нэр — «PDF», «DOCX» */
const extensionLabel = (name: string) => /\.([a-z0-9]{1,5})$/i.exec(name)?.[1]?.toUpperCase() ?? "ФАЙЛ";

type PostComposerProps = {
  initialBody?: string;
  initialVideoLink?: string;
  /** `YYYY-MM-DD` — нийтлэлийн огноо; хоосон бол өнөөдөр */
  initialPeriod?: string;
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
  initialPeriod = "",
  initialMedia = [],
  submitLabel,
  onCancel,
  onSubmit,
}: PostComposerProps) {
  const [body, setBody] = useState(initialBody);
  const [videoLink, setVideoLink] = useState(initialVideoLink);
  const [showLink, setShowLink] = useState(!!initialVideoLink);
  // Огноо — анхдагчаар өнөөдөр; хуучин мэдээлэл бол хэрэглэгч сольж өгнө.
  // Хуучин `YYYY-MM` утгыг тухайн сарын 1-ний өдөр гэж харуулна.
  const [periodDay, setPeriodDay] = useState(
    initialPeriod.length === 7 ? `${initialPeriod}-01` : initialPeriod || todayKey()
  );
  const [keep, setKeep] = useState<PostMedia[]>(initialMedia);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
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

  // Ирээдүйн өдөр сонгогдохгүй (Улаанбаатарын өнөөдөр — сервертэй ижил)
  const today = todayKey();
  const period = periodDay;
  const periodIncomplete = !period || period > today || period < `${POST_PERIOD_MIN_YEAR}-01-01`;

  const pickFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []).map(withKnownType);
    event.target.value = "";
    if (picked.length === 0) return;

    const valid = picked.filter((file) =>
      file.type.startsWith("image/")
        ? file.size <= MAX_POST_IMAGE_BYTES
        : file.type.startsWith("video/")
          ? file.size <= MAX_POST_VIDEO_BYTES
          : isDocument(file) && file.size <= MAX_POST_FILE_BYTES
    );
    const room = MAX_POST_MEDIA - total;

    if (valid.length < picked.length) {
      setError("Зураг 10MB, видео 100MB, PDF/Word/Excel/PowerPoint файл 25MB хүртэл байна.");
    } else if (valid.length > room) {
      setError(`Хамгийн ихдээ ${MAX_POST_MEDIA} файл оруулна.`);
    } else {
      setError(null);
    }

    setFiles((prev) => [...prev, ...valid.slice(0, Math.max(0, room))]);
  };

  const canSubmit =
    !busy && !linkInvalid && !periodIncomplete && (body.trim().length > 0 || total > 0 || linkTrimmed.length > 0);

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
        period,
        keep,
        files,
        onProgress: setProgress,
      });
      if (ok && !onCancel) {
        setBody("");
        setVideoLink("");
        setShowLink(false);
        setPeriodDay(todayKey());
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

  // Баримтууд нь зураг шиг жижиг дүрс биш, нэр хэмжээтэй мөр болж харагдана
  const docs = [
    ...keep
      .filter((item) => item.kind === "file")
      .map((item) => ({
        key: item.path,
        name: item.name ?? "Файл",
        size: item.size ?? 0,
        remove: () => setKeep((prev) => prev.filter((other) => other.path !== item.path)),
      })),
    ...files
      .map((file, index) => ({ file, index }))
      .filter(({ file }) => isDocument(file))
      .map(({ file, index }) => ({
        key: `${file.name}-${index}`,
        name: file.name,
        size: file.size,
        remove: () => setFiles((prev) => prev.filter((_, i) => i !== index)),
      })),
  ];

  const thumbs = [
    ...keep.filter((item) => item.kind !== "file").map((item) => ({
      key: item.path,
      src: item.url,
      video: item.kind === "video",
      remove: () => setKeep((prev) => prev.filter((other) => other.path !== item.path)),
    })),
    ...files
      .map((file, index) => ({ file, index }))
      .filter(({ file }) => !isDocument(file))
      .map(({ file, index }) => ({
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
        className={`${fieldClass} font-reading min-h-[88px] resize-none py-3 text-[15px] leading-7`}
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

      <label className="flex flex-wrap items-center gap-2">
        <CalendarDays className="h-5 w-5 text-warning-500" strokeWidth={1.8} />
        <span className="text-theme-sm text-gray-600 dark:text-gray-300">Огноо:</span>
        <input
          type="date"
          value={periodDay}
          min={`${POST_PERIOD_MIN_YEAR}-01-01`}
          max={today}
          required
          onChange={(event) => setPeriodDay(event.target.value)}
          className={`${fieldClass} h-10 w-auto`}
        />
        {period !== today && !periodIncomplete && (
          <span className="text-theme-xs text-gray-400">Нийтлэл энэ өдрийнхөө байранд эрэмбэлэгдэнэ</span>
        )}
      </label>

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

      {docs.length > 0 && (
        <ul className="flex flex-col gap-2">
          {docs.map((doc) => (
            <li
              key={doc.key}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400">
                <FileText className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-reading block truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                  {doc.name}
                </span>
                <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {extensionLabel(doc.name)}
                  {doc.size > 0 && ` · ${formatFileSize(doc.size)}`}
                </span>
              </span>
              <button
                type="button"
                onClick={doc.remove}
                disabled={busy}
                aria-label={`${doc.name} файлыг хасах`}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" strokeWidth={2} />
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
        <input ref={docInput} type="file" accept={POST_FILE_ACCEPT} multiple onChange={pickFiles} className="hidden" />
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
          onClick={() => docInput.current?.click()}
          disabled={busy || total >= MAX_POST_MEDIA}
          className={toolClass}
        >
          <Paperclip className="h-5 w-5 text-blue-light-500" strokeWidth={1.8} />
          Файл
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
