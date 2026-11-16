"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Settings } from "lucide-react";

import { apiFetch } from "@/lib/apiClient";
import { isLocalFileUrl } from "@/lib/storageUrl";

type VideoInfo = {
  status: "ready" | "processing" | "failed";
  sources: { label: string; url: string }[];
  poster: string | null;
};

/** Хөрвүүлж байх үед дахин шалгах хугацаа */
const POLL_MS = 15_000;

/** Удаан сүлжээ / дата хэмнэх горимд 360p-ээр эхэлнэ */
function prefersLowQuality(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  return !!connection?.saveData || ["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "");
}

/**
 * Нийтлэлийн бичлэг — YouTube шиг: зураг (poster), чанар сонгох (720p / 360p).
 *
 * Сервер бичлэгийг утсанд тохирох хэлбэрт хөрвүүлдэг (@see lib/api/videoTranscode.ts).
 * Хөрвүүлж дуустал эх файлыг тоглуулж, «Боловсруулж байна» гэж харуулна.
 * Firebase-д үлдсэн хуучин бичлэг хөрвүүлэгддэггүй — шууд тоглоно.
 */
export default function VideoPlayer({ url, path }: { url: string; path: string }) {
  const local = isLocalFileUrl(url);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [quality, setQuality] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  /** Чанар солиход тоглуулж байсан байрлалаа хадгална */
  const resume = useRef<{ time: number; playing: boolean } | null>(null);

  useEffect(() => {
    if (!local) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const next = await apiFetch<VideoInfo>(`/api/files/video?path=${encodeURIComponent(path)}`);
        if (cancelled) return;
        setInfo(next);
        if (next.status === "processing") timer = setTimeout(load, POLL_MS);
      } catch {
        // Мэдээлэл ирэхгүй бол эх файлаараа тоглоно
      }
    };
    void load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [local, path]);

  const sources = info?.sources ?? [{ label: "Эх", url }];
  const preferred = prefersLowQuality() ? sources.find((s) => s.label === "360p") : undefined;
  const current = sources.find((s) => s.label === quality) ?? preferred ?? sources[0];

  const choose = (label: string) => {
    const element = video.current;
    if (element && label !== current.label) {
      resume.current = { time: element.currentTime, playing: !element.paused };
    }
    setQuality(label);
    setMenuOpen(false);
  };

  const restore = () => {
    const element = video.current;
    const saved = resume.current;
    if (!element || !saved) return;
    resume.current = null;
    element.currentTime = saved.time;
    if (saved.playing) void element.play().catch(() => {});
  };

  return (
    <div className="relative aspect-video w-full bg-black">
      <video
        ref={video}
        key={current.url}
        src={current.url}
        poster={info?.poster ?? undefined}
        controls
        playsInline
        // Зурагтай бол бичлэгийг дарах хүртэл татахгүй — утасны дата хэмнэнэ
        preload={info?.poster ? "none" : "metadata"}
        onLoadedMetadata={restore}
        className="absolute inset-0 h-full w-full object-contain"
      />

      {info?.status === "processing" && (
        <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-medium text-white">
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          Утсанд тохируулж байна
        </span>
      )}

      {sources.length > 1 && (
        <div className="absolute right-2 top-2">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Бичлэгийн чанар"
            aria-expanded={menuOpen}
            className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-black/80"
          >
            <Settings className="h-3.5 w-3.5" strokeWidth={2} />
            {current.label}
          </button>
          {menuOpen && (
            <ul className="absolute right-0 top-8 z-10 min-w-[96px] overflow-hidden rounded-lg bg-gray-900/95 py-1 text-[13px] text-white shadow-lg">
              {sources.map((source) => (
                <li key={source.label}>
                  <button
                    type="button"
                    onClick={() => choose(source.label)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-white/10 ${
                      source.label === current.label ? "font-semibold text-accent-300" : ""
                    }`}
                  >
                    {source.label}
                    {source.label === current.label && <span aria-hidden>✓</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
