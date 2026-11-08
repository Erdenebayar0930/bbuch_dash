"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";

type ImageViewerProps = {
  /** null бол хаалттай. http болон blob: хаяг хоёуланг нь харуулна */
  src: string | null;
  onClose: () => void;
};

type View = { scale: number; x: number; y: number };

const MIN_SCALE = 1;
const MAX_SCALE = 6;
/** Давхар товшилтоор очих томруулга */
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
/** Үүнээс бага хөдөлгөөнийг чирэлт биш, товшилт гэж үзнэ (px) */
const TAP_SLOP = 6;

const RESET: View = { scale: 1, x: 0, y: 0 };

const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/**
 * Зургийг дэлгэц дүүрэн, бүтнээр нь харуулах давхарга — томруулж, чирж харна.
 *
 * Томруулах: хулганы дугуй, хоёр хуруу (pinch), давхар товшилт, +/− товч.
 * Томруулсан үед нэг хуруу/хулганаар чирнэ. Pointer Events дээр барьсан тул
 * хулгана, хуруу хоёр ижил замаар явна.
 *
 * Modal дотроос дуудагддаг тул Modal-ын Esc сонсогч (document дээр bubble фазад)
 * ажиллаж доод цонхыг хааж орхихоос сэргийлж capture фазад таслав.
 */
export default function ImageViewer({ src, onClose }: ImageViewerProps) {
  const [view, setViewState] = useState<View>(RESET);
  /** Хуруу/хулгана дарагдсан эсэх — чирэх үед анимейшнгүй, шууд дагана */
  const [interacting, setInteracting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Event handler-үүд хамгийн сүүлийн утгыг уншихад (state нь хаагдсан closure-т хуучирна) */
  const viewRef = useRef<View>(RESET);

  const setView = useCallback((next: View) => {
    viewRef.current = next;
    setViewState(next);
  }, []);

  /** Идэвхтэй хуруу/хулганы байрлалууд — pinch-д хоёр нь хэрэгтэй */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    startView: View;
    startX: number;
    startY: number;
    startDist: number;
    moved: boolean;
    /** Зураг дээр дарж эхэлсэн эсэх — pointer capture-ын дараа pointerup-ын target үргэлж контейнер болдог */
    onImage: boolean;
  } | null>(null);
  const lastTap = useRef(0);

  /* Шинэ зураг нээгдэх бүрт томруулгыг тэглэнэ */
  useEffect(() => {
    setView(RESET);
  }, [src, setView]);

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

  /**
   * (clientX, clientY) цэгийг байранд нь үлдээж томруулна — хуруу/курсорын
   * доорх хэсэг рүү ойртоно, төв рүү биш.
   */
  const zoomAt = useCallback((nextScale: number, clientX: number, clientY: number, from = viewRef.current) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const scale = clampScale(nextScale);
    if (!rect || scale === MIN_SCALE) {
      setView(RESET);
      return;
    }

    const px = clientX - (rect.left + rect.width / 2);
    const py = clientY - (rect.top + rect.height / 2);
    const ratio = scale / from.scale;

    setView({
      scale,
      x: px - (px - from.x) * ratio,
      y: py - (py - from.y) * ratio,
    });
  }, [setView]);

  const zoomFromCenter = (factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAt(viewRef.current.scale * factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  /*
   * Дугуйг native сонсогчоор барина: React-ийн onWheel нь passive тул
   * preventDefault хийж чадахгүй — ард байгаа хуудас гүйлгэгдэнэ.
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !src) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
      zoomAt(viewRef.current.scale * factor, event.clientX, event.clientY);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [src, zoomAt]);

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const midpoint = () => {
    const [a, b] = [...pointers.current.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteracting(true);

    gesture.current = {
      startView: viewRef.current,
      startX: event.clientX,
      startY: event.clientY,
      startDist: pointers.current.size === 2 ? distance() : 0,
      // Хоёр дахь хуруу орж ирвэл энэ нь товшилт биш
      moved: pointers.current.size > 1 || (gesture.current?.moved ?? false),
      onImage: (event.target as HTMLElement).tagName === "IMG",
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;

    if (pointers.current.size === 2 && g.startDist > 0) {
      const mid = midpoint();
      zoomAt(g.startView.scale * (distance() / g.startDist), mid.x, mid.y, g.startView);
      g.moved = true;
      return;
    }

    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (Math.hypot(dx, dy) > TAP_SLOP) g.moved = true;

    if (g.startView.scale > MIN_SCALE) {
      setView({ ...g.startView, x: g.startView.x + dx, y: g.startView.y + dy });
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) setInteracting(false);
    const g = gesture.current;

    // Нэг хуруу үлдсэн — чирэлтийг тэр хуруунаас шинээр эхлүүлнэ
    if (pointers.current.size === 1) {
      const [rest] = [...pointers.current.values()];
      gesture.current = { startView: viewRef.current, startX: rest.x, startY: rest.y, startDist: 0, moved: true, onImage: false };
      return;
    }
    gesture.current = null;
    if (!g || g.moved || event.type === "pointercancel") return;

    // Товшилт: давхар бол томруулга солино, ганц бол зургаас гадна дарсан үед хаана
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      if (viewRef.current.scale > MIN_SCALE) setView(RESET);
      else zoomAt(DOUBLE_TAP_SCALE, event.clientX, event.clientY);
      return;
    }
    lastTap.current = now;

    if (!g.onImage && viewRef.current.scale === MIN_SCALE) {
      // Давхар товшилтын цонх өнгөрсний дараа хаана — давхар товшилтыг таслахгүй
      window.setTimeout(() => {
        if (lastTap.current === now) onClose();
      }, DOUBLE_TAP_MS);
    }
  };

  if (!src) return null;

  const zoomed = view.scale > MIN_SCALE;

  return (
    <div className="fixed inset-0 z-999999 bg-black/85">
      <div
        ref={containerRef}
        role="presentation"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`flex h-full w-full touch-none select-none items-center justify-center overflow-hidden p-6 ${
          zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
        }`}
      >
        {/* Байршсан ба хүлээлгэнд буй (blob:) хоёуланг үзүүлэх тул энгийн img */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          className={`max-h-full max-w-full rounded-2xl object-contain will-change-transform ${
            interacting ? "" : "transition-transform duration-150 ease-out"
          }`}
        />
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Хаах"
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30"
      >
        <X className="h-5 w-5" strokeWidth={2} />
      </button>

      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/15 p-1 text-white backdrop-blur-sm">
        <button
          type="button"
          onClick={() => zoomFromCenter(1 / 1.5)}
          disabled={!zoomed}
          aria-label="Жижигрүүлэх"
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          <Minus className="h-4 w-4" strokeWidth={2} />
        </button>
        <span className="min-w-12 text-center text-theme-xs font-medium tabular-nums">
          {Math.round(view.scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => zoomFromCenter(1.5)}
          disabled={view.scale >= MAX_SCALE}
          aria-label="Томруулах"
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => setView(RESET)}
          disabled={!zoomed}
          aria-label="Анхны хэмжээ"
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
