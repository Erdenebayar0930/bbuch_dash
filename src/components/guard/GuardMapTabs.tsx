"use client";

import React, { useState } from "react";

import GuardPointMap from "@/components/guard/GuardPointMap";
import PostFeed from "@/components/posts/PostFeed";

type TabKey = "revealed" | "done" | "places";

const TABS: { key: TabKey; label: string }[] = [
  { key: "revealed", label: "Илчлэгдсэн үйлчлэл" },
  { key: "done", label: "Гүйцэтгэсэн үйлчлэл" },
  { key: "places", label: "Байршлууд" },
];

/**
 * Харуулын «Газрын зургийн үйлчлэл» табууд.
 *
 * • Илчлэгдсэн / Гүйцэтгэсэн үйлчлэл — нийтлэлийн самбар (бичвэр, зураг,
 *   бичлэг, файл, огноо), тус бүр өөрийн бүртгэлтэй
 * • Байршлууд — газрын зураг дээр тэмдэглээд зураг, тайлбар бичнэ
 */
export default function GuardMapTabs() {
  const [active, setActive] = useState<TabKey>("revealed");

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Газрын зургийн үйлчлэл"
        className="flex flex-wrap gap-x-1 border-b border-gray-200 dark:border-white/10"
      >
        {TABS.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`guard-map-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`guard-map-panel-${tab.key}`}
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

      <div role="tabpanel" id={`guard-map-panel-${active}`} aria-labelledby={`guard-map-tab-${active}`}>
        {active === "revealed" ? (
          <PostFeed key="revealed" board="guard-map-revealed" />
        ) : active === "done" ? (
          <PostFeed key="done" board="guard-map-done" />
        ) : (
          <GuardPointMap />
        )}
      </div>
    </div>
  );
}
