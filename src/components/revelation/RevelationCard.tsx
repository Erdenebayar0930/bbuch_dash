"use client";

import React, { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { formatRevelationDate } from "@/data/revelationOptions";
import type { Revelation } from "@/lib/revelations";

type RevelationCardProps = {
  revelation: Revelation;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onOpenImage: (src: string) => void;
};

/** Үүнээс урт бичвэрийг эхлээд хураангуйлж «Цааш унших» гаргана */
const COLLAPSE_AT = 600;

/**
 * Илчлэл нь өөрөө гол — нийтэлсэн хүн харагдахгүй. Бичвэр голлон томоор,
 * зураг нь доор, хамгийн доор жижгээр огноо ба илчлэл авсан хүн
 * («2026 оны 11-р сарын 16 · Г.Мөнгөнцэцэг»). Огноо нь илчлэл ирсэн өдөр
 * (`revealedOn`) — нийтэлсэн цаг биш, нөхөж оруулж болно.
 */
export default function RevelationCard({
  revelation,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onOpenImage,
}: RevelationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Цэсний гадна дарвал хаана
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const { body, images } = revelation;
  const long = body.length > COLLAPSE_AT;
  const shownBody = long && !expanded ? `${body.slice(0, COLLAPSE_AT).trimEnd()}…` : body;

  return (
    <article className="surface overflow-hidden">
      <header className="flex min-h-4 justify-end px-2 pt-2">
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
        <div className={`px-5 text-center sm:px-10 ${canEdit || canDelete ? "pt-1" : "pt-6"}`}>
          <p className="whitespace-pre-line break-words text-lg leading-relaxed text-gray-900 dark:text-white/90 sm:text-xl">
            {shownBody}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              className="mt-2 text-theme-sm font-medium text-gray-500 hover:underline dark:text-gray-400"
            >
              {expanded ? "Хураах" : "Цааш унших"}
            </button>
          )}
        </div>
      )}

      {images.length > 0 && (
        <ImageGrid images={images.map((image) => image.url)} onOpen={onOpenImage} />
      )}

      <footer className="px-5 pb-4 pt-4 text-center text-theme-xs text-gray-400 dark:text-gray-500">
        {formatRevelationDate(revelation.revealedOn)}
        {" · "}
        {revelation.receivedBy}
      </footer>
    </article>
  );
}

/**
 * Facebook-ийн зургийн тор: 1 → бүтэн, 2 → хоёр багана, 3 → нэг том +
 * хоёр жижиг, 4+ → 2×2, илүү гарсныг сүүлийн нүдэн дээр «+N»-ээр харуулна.
 */
function ImageGrid({ images, onOpen }: { images: string[]; onOpen: (src: string) => void }) {
  const shown = images.slice(0, 4);
  const extra = images.length - shown.length;

  const cell = (src: string, index: number, className: string) => (
    <button
      key={`${src}-${index}`}
      type="button"
      onClick={() => onOpen(src)}
      aria-label={`Зураг ${index + 1}-ийг томоор харах`}
      className={`relative block overflow-hidden bg-gray-100 dark:bg-white/5 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Firebase Storage URL */}
      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      {extra > 0 && index === shown.length - 1 && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-semibold text-white">
          +{extra}
        </span>
      )}
    </button>
  );

  if (shown.length === 1) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => onOpen(shown[0])}
          aria-label="Зургийг томоор харах"
          className="block w-full bg-gray-100 dark:bg-white/5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Firebase Storage URL */}
          <img src={shown[0]} alt="" loading="lazy" className="mx-auto max-h-[560px] w-full object-contain" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-0.5">
      {shown.map((src, index) =>
        cell(
          src,
          index,
          shown.length === 3 && index === 0 ? "col-span-2 aspect-[2/1]" : "aspect-square"
        )
      )}
    </div>
  );
}
