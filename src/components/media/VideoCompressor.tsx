"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  FileVideo,
  HardDrive,
  Loader2,
  Share2,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  compressVideo,
  createFileSink,
  formatBytes,
  formatDuration,
  isSupported,
  keepScreenAwake,
  pickMimeType,
  presets,
  readVideoInfo,
  supportsFileSink,
  type CompressPreset,
  type VideoInfo,
} from "@/lib/videoCompress";

type Done = {
  /** Дискэнд шууд бичсэн бол null — урьдчилан үзэх, татах боломжгүй */
  url: string | null;
  blob: Blob | null;
  name: string;
  width: number;
  height: number;
  bytes: number;
};

/** Үүнээс том файлыг санах ойд цуглуулах нь эрсдэлтэй */
const BIG_FILE = 300 * 1024 * 1024;

/**
 * Бичлэг шахах — бүхэлдээ хөтөч дотор.
 *
 * Файл сервер рүү ОГТ илгээгддэггүй: сонгосон бичлэг `blob:` хаягаар нээгдэж,
 * canvas + MediaRecorder-оор дахин кодлогдоод буцаж хадгалагдана.
 *
 * ХОЁР ГОРИМ:
 *  • Дискэнд шууд бичих (Chrome/Edge, ширээний) — хэдэн ГБ ч багтана.
 *  • Санах ойд цуглуулах — бусад хөтөч дээр, зөвхөн богино бичлэгт.
 */
export default function VideoCompressor() {
  const [supported, setSupported] = useState(true);
  const [canStream, setCanStream] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [preset, setPreset] = useState<CompressPreset>(presets[1]);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);

  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const doneUrl = useRef<string | null>(null);

  // MediaRecorder серверт байхгүй тул шалгалтыг зөвхөн клиент дээр
  useEffect(() => {
    setSupported(isSupported());
    setCanStream(supportsFileSink());
  }, []);

  useEffect(() => {
    return () => {
      abort.current?.abort();
      if (doneUrl.current) URL.revokeObjectURL(doneUrl.current);
    };
  }, []);

  const reset = () => {
    if (doneUrl.current) {
      URL.revokeObjectURL(doneUrl.current);
      doneUrl.current = null;
    }
    setDone(null);
    setError("");
    setProgress(0);
  };

  const handlePick = async (picked: File | null) => {
    reset();
    setFile(picked);
    setInfo(null);

    if (!picked) return;

    try {
      setInfo(await readVideoInfo(picked));
    } catch (err) {
      console.error("Метадата уншихад алдаа гарлаа:", err);
      setError("Энэ файлыг бичлэг гэж уншиж чадсангүй.");
    }
  };

  const handleCompress = async () => {
    if (!file) return;

    reset();

    const extension = pickMimeType().includes("mp4") ? "mp4" : "webm";
    const name = `${file.name.replace(/\.[^.]+$/, "")}-shakhsan.${extension}`;

    // Хадгалах байршлыг ЭХЭЛЖ асууна — товч дарсан агшны зөвшөөрөл дээр
    // тулгуурладаг тул шахалт эхэлсний дараа асууж болохгүй
    let sink = null;
    if (canStream) {
      try {
        sink = await createFileSink(name, pickMimeType());
      } catch (err) {
        console.error("Хадгалах байршил сонгоход алдаа гарлаа:", err);
      }

      if (!sink) return; // Хэрэглэгч цуцаллаа
    }

    setBusy(true);
    setStartedAt(Date.now());

    const controller = new AbortController();
    abort.current = controller;
    const releaseWakeLock = keepScreenAwake();

    try {
      const result = await compressVideo(file, preset, {
        onProgress: setProgress,
        signal: controller.signal,
        sink,
      });

      let url: string | null = null;
      if (result.blob) {
        url = URL.createObjectURL(result.blob);
        doneUrl.current = url;
      }

      setDone({
        url,
        blob: result.blob,
        name,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      });
    } catch (err) {
      console.error("Шахахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Шахаж чадсангүй.");
    } finally {
      releaseWakeLock();
      setBusy(false);
      abort.current = null;
    }
  };

  const handleShare = async () => {
    if (!done?.blob) return;

    const shareFile = new File([done.blob], done.name, {
      type: done.blob.type,
    });

    try {
      if (navigator.canShare?.({ files: [shareFile] })) {
        await navigator.share({ files: [shareFile], title: done.name });
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("Хуваалцахад алдаа гарлаа:", err);
      }
    }
  };

  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function";

  const saved =
    done && file ? Math.round((1 - done.bytes / file.size) * 100) : 0;

  /** Бодит хугацаанд кодлодог тул үлдсэн хугацаа ≈ үлдсэн бичлэг */
  const remaining =
    info && progress > 0 ? info.duration * (1 - progress) : info?.duration ?? 0;

  const elapsed = busy && startedAt ? (Date.now() - startedAt) / 1000 : 0;

  /** Санах ойд цуглуулах горимд том файл багтахгүй */
  const tooBigForMemory = !canStream && !!file && file.size > BIG_FILE;

  if (!supported) {
    return (
      <div className="surface flex min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-base font-medium text-gray-800 dark:text-white/90">
          Энэ хөтөч дэмжихгүй байна
        </p>
        <p className="max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
          Бичлэг шахахад Chrome, Edge эсвэл Android-ийн хөтөч хэрэгтэй. iPhone
          дээрх Safari энэ боломжийг дэмждэггүй.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="flex items-start gap-2 rounded-lg bg-success-50 px-4 py-3 text-theme-sm text-success-700 dark:bg-success-500/10 dark:text-success-400">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
        <span>
          Бичлэг таны төхөөрөмж дээр шахагдана — сервер рүү илгээгдэхгүй.
          Интернэтгүй ч ажиллана.
        </span>
      </p>

      <div className="surface p-5">
        <label
          htmlFor="video-file"
          className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Бичлэг сонгох
        </label>
        <input
          id="video-file"
          ref={fileInput}
          type="file"
          accept="video/*"
          disabled={busy}
          onChange={(event) => handlePick(event.target.files?.[0] ?? null)}
          className="h-11 w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-theme-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-theme-xs file:font-medium file:text-gray-700 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:file:bg-white/10 dark:file:text-gray-200"
        />

        {file && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg bg-gray-50 px-4 py-3 text-theme-sm dark:bg-white/[0.03]">
            <span className="inline-flex items-center gap-2 font-medium text-gray-800 dark:text-white/90">
              <FileVideo className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              <span className="max-w-[220px] truncate">{file.name}</span>
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              {formatBytes(file.size)}
            </span>
            {info && (
              <>
                <span className="text-gray-500 dark:text-gray-400">
                  {info.width}×{info.height}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  {formatDuration(info.duration)}
                </span>
              </>
            )}
          </div>
        )}

        {/* Урт бичлэг хэр удахыг УРЬДЧИЛЖ хэлнэ — 2 цаг хүлээхээ мэдэж
            байх нь дундуур нь гайхахаас дээр */}
        {info && info.duration > 300 && !busy && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning-50 px-4 py-3 text-theme-sm text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span>
              Энэ бичлэг {formatDuration(info.duration)} үргэлжилнэ. Шахалт
              бодит хугацаанд явагддаг тул <strong>ойролцоогоор ижил
              хугацаа</strong> шаардана. Энэ хуудсыг нээлттэй байлгана уу.
            </span>
          </p>
        )}

        {tooBigForMemory && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-700 dark:bg-error-500/10 dark:text-error-400">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span>
              Энэ хөтөч дискэнд шууд бичихийг дэмжихгүй тул үр дүн санах ойд
              хуримтлагдана — {formatBytes(file!.size)} хэмжээтэй файл дээр
              унших магадлалтай. Компьютер дээрх <strong>Chrome эсвэл
              Edge</strong>-ээр орж хийнэ үү.
            </span>
          </p>
        )}

        {canStream && (
          <p className="mt-3 flex items-start gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
            <HardDrive className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
            <span>
              «Шахах» дарахад хадгалах байршлыг асууна. Үр дүн шууд тэр файл руу
              бичигдэнэ — хэдэн ГБ ч багтана.
            </span>
          </p>
        )}

        {/* Чанарын сонголт */}
        <p className="mb-2 mt-5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
          Чанар
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {presets.map((item) => {
            const active = item.key === preset.key;

            return (
              <label
                key={item.key}
                className={`flex cursor-pointer flex-col gap-1 rounded-lg border px-3.5 py-3 transition-colors ${
                  active
                    ? "border-accent-400 bg-accent-50/60 dark:border-accent-500/50 dark:bg-accent-500/10"
                    : "border-gray-200 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/[0.03]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="preset"
                    checked={active}
                    disabled={busy}
                    onChange={() => setPreset(item)}
                    className="h-4 w-4 border-gray-300 text-accent-600 focus:ring-accent-500/30 dark:border-white/20 dark:bg-white/10"
                  />
                  <span className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                    {item.label}
                  </span>
                </span>
                <span className="pl-6 text-theme-xs text-gray-500 dark:text-gray-400">
                  {item.hint}
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCompress}
            disabled={busy || !file}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent-600 px-4 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
            ) : (
              <FileVideo className="h-4 w-4" strokeWidth={1.8} />
            )}
            {busy ? "Шахаж байна..." : "Шахах"}
          </button>

          {busy && (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-gray-200 px-4 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <X className="h-4 w-4" strokeWidth={2} />
              Зогсоох
            </button>
          )}
        </div>

        {busy && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-accent-500 transition-[width] duration-300"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
              {Math.round(progress * 100)}% · өнгөрсөн {formatDuration(elapsed)}
              {remaining > 0 && ` · үлдсэн ~${formatDuration(remaining)}`} —
              энэ хуудсыг хаахгүй байна уу.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}
      </div>

      {/* Үр дүн */}
      {done && file && (
        <div className="surface p-5">
          <p className="flex items-start gap-2 text-theme-sm text-success-700 dark:text-success-400">
            <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
            <span>
              {formatBytes(file.size)} → <strong>{formatBytes(done.bytes)}</strong>{" "}
              ({done.width}×{done.height})
              {saved > 0 ? ` — ${saved}% багасав` : ""}
            </span>
          </p>

          {saved <= 0 && (
            <p className="mt-2 text-theme-xs text-warning-600 dark:text-warning-400">
              Эх бичлэг аль хэдийн сайн шахагдсан тул хэмжээ багасаагүй байна.
              Илүү бага чанар сонгож үзнэ үү.
            </p>
          )}

          {done.url ? (
            <>
              <video
                src={done.url}
                controls
                className="mt-4 max-h-[360px] w-full rounded-lg bg-black"
              />

              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={done.url}
                  download={done.name}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent-600 px-4 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700"
                >
                  <Download className="h-4 w-4" strokeWidth={1.8} />
                  Татаж авах
                </a>

                {canShare && (
                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-gray-200 px-4 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    <Share2 className="h-4 w-4" strokeWidth={1.8} />
                    Хуваалцах
                  </button>
                )}
              </div>
            </>
          ) : (
            // Дискэнд шууд бичсэн тул санах ойд хуулбар байхгүй — урьдчилан
            // үзүүлэх нь 2ГБ-ыг RAM руу татна
            <p className="mt-3 flex items-start gap-2 text-theme-sm text-gray-600 dark:text-gray-300">
              <HardDrive className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
              <span>
                <strong>{done.name}</strong> нэрээр сонгосон байршилд
                хадгалагдлаа.
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}