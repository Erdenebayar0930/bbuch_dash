"use client";

import React from "react";

import { temperaments } from "@/data/profileOptions";

/** Оноо энэ утгаас хэтэрвэл серверийн шалгалт татгалзана */
const MAX_SCORE = 999;

type TemperamentPickerProps = {
  /** Сонгосон төрөл бүр оноотойгоо — сонгоогүй нь огт байхгүй */
  value: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
};

/**
 * Темперамент — олон төрлийг зэрэг сонгож, тус бүрд нь оноо өгнө.
 * Тэмдэглэгээг авахад тухайн төрөл бүхэлдээ жагсаалтаас хасагдана.
 */
export default function TemperamentPicker({
  value,
  onChange,
}: TemperamentPickerProps) {
  const total = Object.values(value).reduce((sum, score) => sum + score, 0);

  const toggle = (key: string, checked: boolean) => {
    const next = { ...value };

    if (checked) {
      next[key] = next[key] ?? 0;
    } else {
      delete next[key];
    }

    onChange(next);
  };

  const setScore = (key: string, raw: string) => {
    // Хоосон талбарыг 0 гэж үзнэ — бичиж байхад утга алдагдахгүй
    const parsed = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(parsed)) return;

    const score = Math.min(MAX_SCORE, Math.max(0, Math.trunc(parsed)));
    onChange({ ...value, [key]: score });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {temperaments.map((option) => {
          const selected = option.value in value;

          return (
            <div
              key={option.value}
              className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors ${
                selected
                  ? "border-accent-400 bg-accent-50/60 dark:border-accent-500/50 dark:bg-accent-500/10"
                  : "border-gray-200 dark:border-white/10"
              }`}
            >
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(event) => toggle(option.value, event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500/30 dark:border-white/20 dark:bg-white/10"
                />
                <span className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                  {option.label}
                </span>
              </label>

              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_SCORE}
                value={selected ? value[option.value] : ""}
                onChange={(event) => setScore(option.value, event.target.value)}
                disabled={!selected}
                aria-label={`${option.label} оноо`}
                placeholder="0"
                className="h-9 w-20 rounded-lg border border-gray-200 bg-white px-2.5 text-right text-theme-sm text-gray-800 transition-colors focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:disabled:bg-white/[0.02]"
              />
            </div>
          );
        })}
      </div>

      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        Тохирох төрлүүдийг сонгоод оноог нь оруулна. Нийт:{" "}
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {total}
        </span>
      </p>
    </div>
  );
}
