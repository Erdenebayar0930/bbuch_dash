"use client";

import React, { useState } from "react";

import RevelationFeed from "@/components/revelation/RevelationFeed";

type TabKey = "general" | "named" | "progress";

const TABS: { key: TabKey; label: string }[] = [
  { key: "general", label: "Ерөнхий тушаалууд" },
  { key: "named", label: "Нэр цохож хэлсэн тушаал" },
  { key: "progress", label: "Төлөвлөгөө" },
];

/**
 * Аймгийн «Тушаал» цэсний табууд.
 *
 * • Ерөнхий тушаалууд, Нэр цохож хэлсэн тушаал — Илчлэлийн загвартай
 *   (бичвэр, огноо, зураг, «Тушаал авсан»), тус бүр өөрийн бүртгэлтэй
 *   (`revelations.kind`, @see data/revelationOptions.ts)
 * • Төлөвлөгөө — тушаал, төлөвлөгөөний ажлын самбар (`progress`-оор дамжуулна)
 */
export default function CommandTabs({ aimag, progress }: { aimag: string; progress: React.ReactNode }) {
  const [active, setActive] = useState<TabKey>("general");

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Тушаал"
        className="flex flex-wrap gap-x-1 border-b border-gray-200 dark:border-white/10"
      >
        {TABS.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`command-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`command-panel-${tab.key}`}
              onClick={() => setActive(tab.key)}
              className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-theme-sm font-medium transition-colors ${
                selected
                  ? "border-accent-600 text-accent-700 dark:border-accent-400 dark:text-accent-300"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`command-panel-${active}`} aria-labelledby={`command-tab-${active}`}>
        {active === "general" ? (
          <RevelationFeed key="general" aimag={aimag} kind="general-command" />
        ) : active === "named" ? (
          <RevelationFeed key="named" aimag={aimag} kind="named-command" />
        ) : (
          progress
        )}
      </div>
    </div>
  );
}
