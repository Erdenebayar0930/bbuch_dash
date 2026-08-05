"use client";

import React from "react";

import type { Option } from "@/data/profileOptions";

type SettingsSelectProps = {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  /** Хоосон сонголтын бичиг — сонгоогүй байхыг зөвшөөрнө */
  emptyLabel?: string;
  hint?: string;
  className?: string;
};

/** Тохиргооны маягтын сонголт — SettingsField-тэй ижил өндөр, өнгө. */
export default function SettingsSelect({
  id,
  label,
  value,
  options,
  onChange,
  emptyLabel = "Сонгоогүй",
  hint,
  className = "",
}: SettingsSelectProps) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-theme-sm text-gray-800 shadow-theme-xs transition-colors focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p className="mt-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
}
