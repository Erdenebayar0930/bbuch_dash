"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

type ImageViewerProps = {
  /** null бол хаалттай. http болон blob: хаяг хоёуланг нь харуулна */
  src: string | null;
  onClose: () => void;
};

/**
 * Зургийг дэлгэц дүүрэн, бүтнээр нь харуулах давхарга.
 *
 * Modal дотроос дуудагддаг тул Modal-ын Esc сонсогч (document дээр bubble фазад)
 * ажиллаж доод цонхыг хааж орхихоос сэргийлж capture фазад таслав.
 */
export default function ImageViewer({ src, onClose }: ImageViewerProps) {
  useEffect(() => {
    if (!src) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };

    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-999999 flex cursor-zoom-out items-center justify-center bg-black/80 p-6"
    >
      {/* Байршсан ба хүлээлгэнд буй (blob:) хоёуланг үзүүлэх тул энгийн img */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="max-h-full max-w-full rounded-2xl object-contain"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Хаах"
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30"
      >
        <X className="h-5 w-5" strokeWidth={2} />
      </button>
    </div>
  );
}
