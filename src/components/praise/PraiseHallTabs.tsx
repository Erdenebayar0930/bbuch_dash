"use client";

import React, { useState } from "react";

import PostFeed from "@/components/posts/PostFeed";
import ScheduleBoard from "@/components/schedule/ScheduleBoard";

type TabKey = "about" | "orders" | "schedule";

const TABS: { key: TabKey; label: string }[] = [
  { key: "about", label: "Асрын үйлчлэлийн талаар" },
  { key: "orders", label: "Асарт үйлчлэх тушаал ба онцлогууд" },
  { key: "schedule", label: "Асрын үйлчлэлийн хуваарь" },
];

/**
 * Магтаалын «Асрын үйлчлэл» табууд.
 *
 * • Асрын үйлчлэлийн талаар — нийтлэлийн самбар (`praise-hall`)
 * • Асарт үйлчлэх тушаал ба онцлогууд — нийтлэл + нэр цохох (`praise-hall-orders`)
 * • Асрын үйлчлэлийн хуваарь — ээлжийн хуваарь (`care`), ээлжийг админ нэмнэ
 */
export default function PraiseHallTabs() {
  const [active, setActive] = useState<TabKey>("about");

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Асрын үйлчлэл"
        className="flex gap-x-1 overflow-x-auto overflow-y-hidden no-scrollbar border-b border-gray-200 dark:border-white/10"
      >
        {TABS.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`praise-hall-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`praise-hall-panel-${tab.key}`}
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

      <div role="tabpanel" id={`praise-hall-panel-${active}`} aria-labelledby={`praise-hall-tab-${active}`}>
        {active === "about" ? (
          <PostFeed key="about" board="praise-hall" />
        ) : active === "orders" ? (
          <PostFeed key="orders" board="praise-hall-orders" />
        ) : (
          <ScheduleBoard kind="care" />
        )}
      </div>
    </div>
  );
}
