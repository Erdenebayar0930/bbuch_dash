"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Илчлэлийн бичвэрийн үсгийн хэмжээ — хэрэглэгч Тохиргоо → Харагдац хэсгээс
 * сонгоно. Сонголт нь энэ төхөөрөмжийн localStorage-д хадгалагдана (өнгөний
 * горимтой адил), тиймээс useSyncExternalStore-оор уншина.
 */
export type RevelationFontSize = "sm" | "md" | "lg" | "xl";

export const REVELATION_FONT_SIZES: {
  key: RevelationFontSize;
  name: string;
  /** Tailwind-д бүтнээр нь бичих ёстой — динамикаар угсарвал class үүсэхгүй */
  className: string;
}[] = [
  { key: "sm", name: "Жижиг", className: "text-base sm:text-lg" },
  { key: "md", name: "Дунд", className: "text-lg sm:text-xl" },
  { key: "lg", name: "Том", className: "text-xl sm:text-2xl" },
  { key: "xl", name: "Маш том", className: "text-2xl sm:text-3xl" },
];

const STORAGE_KEY = "revelationFontSize";
const DEFAULT: RevelationFontSize = "md";

let listeners: Array<() => void> = [];

const subscribe = (onChange: () => void) => {
  listeners.push(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners = listeners.filter((listener) => listener !== onChange);
    window.removeEventListener("storage", onStorage);
  };
};

function read(): RevelationFontSize {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return REVELATION_FONT_SIZES.some((size) => size.key === raw)
      ? (raw as RevelationFontSize)
      : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function revelationFontClass(size: RevelationFontSize) {
  return (
    REVELATION_FONT_SIZES.find((option) => option.key === size)?.className ??
    REVELATION_FONT_SIZES[1].className
  );
}

export function useRevelationFontSize() {
  const size = useSyncExternalStore(subscribe, read, () => DEFAULT);

  const setSize = useCallback((next: RevelationFontSize) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Хувийн горимд бичих боломжгүй байж болно
    }
    listeners.forEach((listener) => listener());
  }, []);

  return { size, setSize };
}
