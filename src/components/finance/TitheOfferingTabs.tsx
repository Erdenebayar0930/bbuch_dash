"use client";

import React, { useState } from "react";

import TitheAccountCard from "@/components/finance/TitheAccountCard";
import PostFeed from "@/components/posts/PostFeed";

type TabKey = "about" | "guide" | "giving";

/** Хуудас бүрийн нэршил — 1/10 ба өргөл, Газрын 1/10 хоёр ижил загвартай */
const VARIANTS = {
  tithe: { title: "1/10 ба өргөл", about: "1/10 ба өргөлийн талаар", giving: "tithe-giving" },
  land: { title: "Газрын 1/10", about: "Газрын 1/10-ийн талаар", giving: "land-giving" },
} as const;

type TitheOfferingTabsProps = {
  /** `tithe` — 1/10 ба өргөл, `land` — Газрын 1/10 */
  variant?: keyof typeof VARIANTS;
};

/**
 * Санхүү → 1/10 ба өргөл / Газрын 1/10 хуудасны табууд.
 *
 * • …-ийн талаар — нийтлэл оруулдаг самбар (`PostFeed`, board = tithe | land)
 * • Өргөх заавар — өргөх данс ба гүйлгээний утгыг хуулах (бүгдэд)
 * • Өргөж буй байдал — мөн нийтлэлийн самбар, тусдаа board
 *   (tithe-giving | land-giving)
 */
export default function TitheOfferingTabs({ variant = "tithe" }: TitheOfferingTabsProps) {
  const names = VARIANTS[variant];

  const tabs: { key: TabKey; label: string }[] = [
    { key: "about", label: names.about },
    { key: "guide", label: "Өргөх заавар" },
    { key: "giving", label: "Өргөж буй байдал" },
  ];

  const [active, setActive] = useState<TabKey>("about");

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label={names.title}
        className="flex flex-wrap gap-x-1 border-b border-gray-200 dark:border-white/10"
      >
        {tabs.map((tab) => {
          const isSelected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`tithe-tab-${tab.key}`}
              aria-selected={isSelected}
              aria-controls={`tithe-panel-${tab.key}`}
              onClick={() => setActive(tab.key)}
              className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-theme-sm font-medium transition-colors ${
                isSelected
                  ? "border-accent-600 text-accent-700 dark:border-accent-400 dark:text-accent-300"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`tithe-panel-${active}`} aria-labelledby={`tithe-tab-${active}`}>
        {active === "guide" ? (
          <TitheAccountCard variant={variant} />
        ) : active === "giving" ? (
          // key — «…талаар» самбараас шилжихэд төлөвөө дахин эхлүүлнэ
          <PostFeed key={names.giving} board={names.giving} />
        ) : (
          <PostFeed key={variant} board={variant} />
        )}
      </div>
    </div>
  );
}
