"use client";

import React from "react";

import Checkbox from "@/components/form/input/Checkbox";

import type { Option } from "@/data/profileOptions";

type ScoredMultiSelectProps = {
  label: string;
  description?: string;
  options: Option[];
  value: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
};

const MAX_SCORE = 999;

/**
 * Олон сонголт зэрэг чагтлаж, сонгосон бүрт нь оноо өгдөг талбар.
 * Темперамент, Хайрын хэл хоёуланд нь ашиглана — хоёулаа адил хэлбэртэй.
 */
export default function ScoredMultiSelect({
  label,
  description,
  options,
  value,
  onChange,
}: ScoredMultiSelectProps) {
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
    const parsed = Number(raw);
    const score = Number.isFinite(parsed)
      ? Math.min(MAX_SCORE, Math.max(0, Math.round(parsed)))
      : 0;

    onChange({ ...value, [key]: score });
  };

  return (
    <div>
      <p className="mb-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </p>
      {description && (
        <p className="mb-2 text-theme-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {options.map((option) => {
          const checked = option.value in value;

          return (
            <div key={option.value} className="flex items-center gap-3">
              <Checkbox
                id={`scored-${option.value}`}
                label={option.label}
                checked={checked}
                onChange={(next) => toggle(option.value, next)}
              />
              {checked && (
                <input
                  type="number"
                  min={0}
                  max={MAX_SCORE}
                  value={value[option.value]}
                  onChange={(event) => setScore(option.value, event.target.value)}
                  aria-label={`${option.label} оноо`}
                  className="h-8 w-20 rounded-lg border border-gray-200 bg-white px-2.5 text-theme-xs text-gray-800 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
