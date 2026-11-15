"use client";

import React, { useState } from "react";
import { Construction } from "lucide-react";

export type SectionTab = {
  key: string;
  label: string;
  /** Агуулга бэлэн болох хүртэл харуулах тайлбар */
  description: string;
};

type SectionTabsProps = {
  /** Табын жагсаалтын нэр — дэлгэц уншигчид */
  label: string;
  tabs: SectionTab[];
};

/**
 * Хуудас доторх таб — «Сайн мэдээ»-ний ангилалтай ижил загвар. Тахилт дахь
 * чуулганы Цуглаан, Итгэгчид хуудсууд ашиглана. Агуулга нь хараахан
 * тодорхойгүй тул таб бүр «бэлтгэгдэж байна» гэж харуулна.
 */
export default function SectionTabs({ label, tabs }: SectionTabsProps) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const tab = tabs.find((item) => item.key === active) ?? tabs[0];

  if (!tab) return null;

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-white/10"
      >
        {tabs.map((item) => {
          const selected = item.key === tab.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`tab-${item.key}`}
              aria-selected={selected}
              aria-controls={`panel-${item.key}`}
              onClick={() => setActive(item.key)}
              className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-theme-sm font-medium transition-colors ${
                selected
                  ? "border-accent-600 text-accent-700 dark:border-accent-400 dark:text-accent-300"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${tab.key}`}
        aria-labelledby={`tab-${tab.key}`}
        className="surface flex min-h-[320px] flex-col items-center justify-center gap-3 p-10 text-center"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500">
          <Construction className="h-6 w-6" strokeWidth={1.6} />
        </span>
        <p className="text-base font-medium text-gray-800 dark:text-white/90">
          {tab.label} — бэлтгэгдэж байна
        </p>
        <p className="max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
          {tab.description}. Удахгүй ашиглалтад орно.
        </p>
      </div>
    </div>
  );
}
