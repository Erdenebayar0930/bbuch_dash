"use client";

import React from "react";
import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import { useTheme, type ThemePreference } from "@/context/ThemeContext";
import {
  REVELATION_FONT_SIZES,
  revelationFontClass,
  useRevelationFontSize,
} from "@/lib/revelationFontSize";

type Option = {
  key: ThemePreference;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Урьдчилсан харагдацын өнгө — сонгосон горимыг нүдээр таниулна */
  preview: { shell: string; bar: string; line: string; block: string };
};

const options: Option[] = [
  {
    key: "light",
    name: "Гэрэлтэй",
    description: "Үргэлж цайвар дэвсгэр",
    icon: Sun,
    preview: {
      shell: "bg-white border-gray-200",
      bar: "bg-gray-200",
      line: "bg-gray-300",
      block: "bg-gray-100",
    },
  },
  {
    key: "dark",
    name: "Харанхуй",
    description: "Үргэлж бараан дэвсгэр",
    icon: Moon,
    preview: {
      shell: "bg-gray-900 border-gray-700",
      bar: "bg-gray-700",
      line: "bg-gray-600",
      block: "bg-gray-800",
    },
  },
  {
    key: "system",
    name: "Систем",
    description: "Төхөөрөмжийн тохиргоог дагана",
    icon: Monitor,
    preview: {
      shell: "bg-gradient-to-br from-white to-gray-900 border-gray-400",
      bar: "bg-gray-400",
      line: "bg-gray-500",
      block: "bg-gray-500/40",
    },
  },
];

export default function AppearanceSettings() {
  const { preference, theme, setPreference } = useTheme();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-medium text-gray-800 dark:text-white/90">
          Өнгөний горим
        </h2>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Сонголт нь энэ төхөөрөмж дээр хадгалагдана. Толгой хэсгийн нар/сар
          товч ч мөн адил энэ тохиргоог өөрчилнө.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = option.key === preference;

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setPreference(option.key)}
              aria-pressed={isActive}
              className={`group flex flex-col gap-3 rounded-xl border p-3 text-left transition-colors ${
                isActive
                  ? "border-accent-500 bg-accent-50/60 dark:border-accent-500 dark:bg-accent-500/10"
                  : "border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
              }`}
            >
              {/* Жижиг макет — горим бүрийн ялгааг харуулна */}
              <span
                className={`flex h-20 w-full gap-1.5 overflow-hidden rounded-lg border p-1.5 ${option.preview.shell}`}
                aria-hidden="true"
              >
                <span className="flex w-1/3 flex-col gap-1">
                  <span className={`h-1.5 w-full rounded-full ${option.preview.bar}`} />
                  <span className={`h-1.5 w-3/4 rounded-full ${option.preview.line}`} />
                  <span className={`h-1.5 w-2/3 rounded-full ${option.preview.line}`} />
                </span>
                <span className={`flex-1 rounded ${option.preview.block}`} />
              </span>

              <span className="flex items-start gap-2">
                <Icon
                  className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${
                    isActive
                      ? "text-accent-600 dark:text-accent-400"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                  strokeWidth={1.8}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`text-theme-sm font-medium ${
                        isActive
                          ? "text-accent-700 dark:text-accent-300"
                          : "text-gray-800 dark:text-white/90"
                      }`}
                    >
                      {option.name}
                    </span>
                    {isActive && (
                      <Check
                        className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400"
                        strokeWidth={2.4}
                      />
                    )}
                  </span>
                  <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
                    {option.description}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {preference === "system" && (
        <p className="rounded-lg bg-accent-50/70 px-4 py-3 text-theme-sm text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
          Одоогоор таны төхөөрөмж{" "}
          <span className="font-medium text-gray-900 dark:text-white">
            {theme === "dark" ? "харанхуй" : "гэрэлтэй"}
          </span>{" "}
          горимд байна. Төхөөрөмжийн тохиргоо солигдоход апп шууд дагана.
        </p>
      )}

      <RevelationFontSizeSetting />
    </div>
  );
}

function RevelationFontSizeSetting() {
  const { size, setSize } = useRevelationFontSize();

  return (
    <div className="flex flex-col gap-4 border-t border-gray-100 pt-6 dark:border-white/5">
      <div>
        <h2 className="text-base font-medium text-gray-800 dark:text-white/90">
          Илчлэлийн үсгийн хэмжээ
        </h2>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Илчлэлийн бичвэр ямар томоор харагдахыг сонгоно. Энэ төхөөрөмж дээр
          хадгалагдана.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {REVELATION_FONT_SIZES.map((option) => {
          const isActive = option.key === size;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setSize(option.key)}
              aria-pressed={isActive}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-theme-sm font-medium transition-colors ${
                isActive
                  ? "border-accent-500 bg-accent-50/60 text-accent-700 dark:border-accent-500 dark:bg-accent-500/10 dark:text-accent-300"
                  : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:hover:bg-white/[0.06]"
              }`}
            >
              {option.name}
              {isActive && <Check className="h-3.5 w-3.5" strokeWidth={2.4} />}
            </button>
          );
        })}
      </div>

      {/* Урьдчилсан харагдац */}
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-6 text-center dark:border-white/10 dark:bg-white/[0.03]">
        <p
          className={`leading-relaxed text-gray-900 dark:text-white/90 ${revelationFontClass(size)}`}
        >
          Жишээ бичвэр — илчлэл ингэж харагдана.
        </p>
      </div>
    </div>
  );
}
