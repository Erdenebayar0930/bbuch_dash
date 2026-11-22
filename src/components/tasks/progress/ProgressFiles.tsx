"use client";

import React from "react";
import { Download, FileText, Video } from "lucide-react";

import { formatFileSize } from "@/data/postOptions";
import type { TaskUpdate } from "@/lib/taskProgress";

/**
 * Ажлын талаарх бүх файл — явцын мэдээллүүдэд хавсаргасан зураг, бичлэг,
 * баримтыг нэг дор. Хэн, хэдийд оруулсныг хамт харуулна.
 */
export default function ProgressFiles({
  updates,
  onOpenImage,
}: {
  updates: TaskUpdate[];
  onOpenImage: (src: string) => void;
}) {
  const all = updates.flatMap((update) =>
    update.media.map((item) => ({ ...item, author: update.authorName, period: update.period }))
  );
  const images = all.filter((item) => item.kind === "image");
  const videos = all.filter((item) => item.kind === "video");
  const docs = all.filter((item) => item.kind === "file");

  if (all.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-theme-sm text-gray-400 dark:border-white/10">
        Файл оруулаагүй байна. «Явц» табаас зураг, файл хавсаргана.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {docs.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">Баримт бичиг ({docs.length})</h3>
          <ul className="flex flex-col gap-2">
            {docs.map((file) => {
              const name = file.name || "Файл";
              return (
                <li key={file.path}>
                  <a
                    href={file.url}
                    download={name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 hover:border-accent-300 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400">
                      <FileText className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">{name}</span>
                      <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                        {file.author} · {file.period}
                        {file.size ? ` · ${formatFileSize(file.size)}` : ""}
                      </span>
                    </span>
                    <Download className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-accent-600" strokeWidth={2} />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {images.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">Зураг ({images.length})</h3>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((image) => (
              <li key={image.path}>
                <button
                  type="button"
                  onClick={() => onOpenImage(image.url)}
                  title={`${image.author} · ${image.period}`}
                  className="block aspect-square w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-white/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- Storage-ийн URL */}
                  <img src={image.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {videos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">Бичлэг ({videos.length})</h3>
          <ul className="flex flex-col gap-2">
            {videos.map((video) => (
              <li key={video.path}>
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-theme-sm text-gray-700 hover:border-accent-300 dark:border-white/10 dark:text-gray-300"
                >
                  <Video className="h-5 w-5 text-error-500" strokeWidth={1.8} />
                  {video.author} · {video.period}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
