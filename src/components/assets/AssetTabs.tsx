"use client";

import React, { useState } from "react";

import AssetRegistry, { type AssetView } from "./AssetRegistry";

export type AssetSection = "register" | "warehouse";

/**
 * Эд хөрөнгийн хоёр цэсийн табууд. Бүгд нэг бүртгэл; таб бүр өөр ангиллаар
 * шүүнэ (@see AssetRegistry ASSET_VIEWS).
 *
 * • Эд хөрөнгийн ерөнхий бүртгэл — Ерөнхий бүртгэл, Акталсан хөрөнгийн бүртгэл
 * • Агуулахын бүртгэл — Агуулахын бүртгэл, Ашиглалтын байдал
 */
const SECTION_TABS: Record<AssetSection, { view: AssetView; label: string }[]> = {
  register: [
    { view: "general", label: "Ерөнхий бүртгэл" },
    { view: "written_off", label: "Акталсан хөрөнгийн бүртгэл" },
  ],
  warehouse: [
    { view: "warehouse", label: "Агуулахын бүртгэл" },
    { view: "usage", label: "Ашиглалтын байдал" },
  ],
};

type AssetTabsProps = {
  section: AssetSection;
  aimag?: string;
};

export default function AssetTabs({ section, aimag }: AssetTabsProps) {
  const tabs = SECTION_TABS[section];
  const [view, setView] = useState<AssetView>(tabs[0].view);

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Эд хөрөнгө"
        className="flex gap-x-1 overflow-x-auto overflow-y-hidden no-scrollbar border-b border-gray-200 dark:border-white/10"
      >
        {tabs.map((tab) => {
          const selected = tab.view === view;
          return (
            <button
              key={tab.view}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setView(tab.view)}
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

      {/* key — таб солиход шүүлтүүр, сонголт шинээр эхэлнэ */}
      <AssetRegistry key={view} aimag={aimag} view={view} />
    </div>
  );
}
