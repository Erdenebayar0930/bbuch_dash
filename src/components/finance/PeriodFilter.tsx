"use client";

import React from "react";

import { monthsOfYear } from "@/data/finance";

type PeriodFilterProps = {
  /** Сонгох боломжтой онууд */
  years: number[];
  year: number;
  /** null = бүтэн жил */
  month: number | null;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number | null) => void;
  /** Баруун талд гарах хураангуй тэмдэглэл */
  summary?: React.ReactNode;
};

const chipBase =
  "num inline-flex h-8 min-w-[38px] items-center justify-center rounded-lg border px-3 text-theme-sm font-medium transition-colors";

const chipIdle =
  "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/10";

export default function PeriodFilter({
  years,
  year,
  month,
  onYearChange,
  onMonthChange,
  summary,
}: PeriodFilterProps) {
  return (
    <div className="surface flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
      {/* Он */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
          Он:
        </span>
        {years.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onYearChange(value)}
            className={`${chipBase} ${
              value === year
                ? "border-navy-900 bg-navy-900 text-white"
                : chipIdle
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {/* Сар */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
          Сар:
        </span>
        <button
          type="button"
          onClick={() => onMonthChange(null)}
          className={`${chipBase} font-outfit ${
            month === null
              ? "border-accent-600 bg-accent-600 text-white"
              : chipIdle
          }`}
        >
          Бүгд
        </button>
        {monthsOfYear.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onMonthChange(value)}
            className={`${chipBase} ${
              value === month
                ? "border-accent-600 bg-accent-600 text-white"
                : chipIdle
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {summary && (
        <p className="ml-auto text-theme-sm italic text-gray-500 dark:text-gray-400">
          {summary}
        </p>
      )}
    </div>
  );
}
