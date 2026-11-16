"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

import {
  DEFAULT_REVELATION_SOURCE,
  MAX_REVELATION_IMAGES,
  MAX_REVELATION_IMAGE_BYTES,
  MAX_REVELATION_LENGTH,
  MAX_REVELATION_SOURCE_LENGTH,
  todayIso,
} from "@/data/revelationOptions";
import type { RevelationImage } from "@/lib/revelations";
import DateInput from "@/components/form/DateInput";

type RevelationComposerProps = {
  /** Засах үед одоогийн бичвэр ба зургууд */
  initialBody?: string;
  /** Илчлэл авсан хүн — хоосон бол тогтмол нэр */
  initialReceivedBy?: string;
  /** Илчлэл ирсэн өдөр — хоосон бол өнөөдөр */
  initialRevealedOn?: string;
  initialImages?: RevelationImage[];
  submitLabel: string;
  placeholder?: string;
  /** Засвар үед «Болих» товч гаргана */
  onCancel?: () => void;
  /** Амжилттай бол true — маягт цэвэрлэгдэнэ */
  onSubmit: (input: {
    body: string;
    receivedBy: string;
    revealedOn: string;
    keep: RevelationImage[];
    files: File[];
  }) => Promise<boolean>;
};

/**
 * Нийтлэл бичих / засах хэсэг — бичвэр ба зураг.
 * Шинэ нийтлэл ба засвар хоёулаа энэ нэг хэсгийг ашиглана.
 */
export default function RevelationComposer({
  initialBody = "",
  initialReceivedBy = DEFAULT_REVELATION_SOURCE,
  initialRevealedOn,
  initialImages = [],
  submitLabel,
  placeholder = "Илчлэлээ бичнэ үү...",
  onCancel,
  onSubmit,
}: RevelationComposerProps) {
  const [body, setBody] = useState(initialBody);
  const [receivedBy, setReceivedBy] = useState(initialReceivedBy);
  const [revealedOn, setRevealedOn] = useState(initialRevealedOn ?? todayIso());
  const [keep, setKeep] = useState<RevelationImage[]>(initialImages);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  // Шинэ файлуудын түр URL — солигдох/хаагдах үед чөлөөлнө
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  // Бичвэр уртсах тусам талбар өөрөө томорно
  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 480)}px`;
  }, [body]);

  const total = keep.length + files.length;

  const pickFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.length === 0) return;

    const valid = picked.filter(
      (file) => file.type.startsWith("image/") && file.size <= MAX_REVELATION_IMAGE_BYTES
    );
    const room = MAX_REVELATION_IMAGES - total;

    if (valid.length < picked.length) {
      setError("Зөвхөн 10MB хүртэлх зураг оруулна.");
    } else if (valid.length > room) {
      setError(`Хамгийн ихдээ ${MAX_REVELATION_IMAGES} зураг оруулна.`);
    } else {
      setError(null);
    }

    setFiles((prev) => [...prev, ...valid.slice(0, Math.max(0, room))]);
  };

  const canSubmit = !busy && (body.trim().length > 0 || total > 0);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);

    try {
      const ok = await onSubmit({
        body: body.trim(),
        receivedBy: receivedBy.trim() || DEFAULT_REVELATION_SOURCE,
        revealedOn: revealedOn || todayIso(),
        keep,
        files,
      });
      if (ok && !onCancel) {
        setBody("");
        setReceivedBy(DEFAULT_REVELATION_SOURCE);
        setRevealedOn(todayIso());
        setKeep([]);
        setFiles([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Нийтлэхэд алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  };

  const thumbs = [
    ...keep.map((image) => ({
      key: image.path,
      src: image.url,
      remove: () => setKeep((prev) => prev.filter((item) => item.path !== image.path)),
    })),
    ...files.map((file, index) => ({
      key: `${file.name}-${index}`,
      src: previews[index],
      remove: () => setFiles((prev) => prev.filter((_, i) => i !== index)),
    })),
  ];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <textarea
        ref={textarea}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        maxLength={MAX_REVELATION_LENGTH}
        rows={3}
        className="min-h-[88px] w-full resize-none rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-theme-sm leading-relaxed text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30"
      />

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">Огноо</span>
          <DateInput
            value={revealedOn}
            max={todayIso()}
            onChange={(event) => setRevealedOn(event.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
          />
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 sm:max-w-xs">
          <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
            Илчлэл авсан
          </span>
          <input
            type="text"
            value={receivedBy}
            onChange={(event) => setReceivedBy(event.target.value)}
            placeholder={DEFAULT_REVELATION_SOURCE}
            maxLength={MAX_REVELATION_SOURCE_LENGTH}
            className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
          />
        </label>
      </div>

      {thumbs.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {thumbs.map((thumb) => (
            <li key={thumb.key} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- Storage/түр blob URL */}
              <img
                src={thumb.src}
                alt=""
                className="h-20 w-20 rounded-lg border border-gray-200 object-cover dark:border-white/10"
              />
              <button
                type="button"
                onClick={thumb.remove}
                disabled={busy}
                aria-label="Зургийг хасах"
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900/80 text-white transition-colors hover:bg-gray-900"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-2.5 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-white/5">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          onChange={pickFiles}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy || total >= MAX_REVELATION_IMAGES}
          className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-theme-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-white/5"
        >
          <ImagePlus className="h-5 w-5 text-success-600 dark:text-success-400" strokeWidth={1.8} />
          Зураг
          {total > 0 && (
            <span className="text-theme-xs text-gray-400">
              {total}/{MAX_REVELATION_IMAGES}
            </span>
          )}
        </button>

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
            {busy ? "Түр хүлээнэ үү..." : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
