"use client";

import React, { useState } from "react";

import PostFeed from "@/components/posts/PostFeed";
import { POST_BOARDS, type PostBoard } from "@/data/postOptions";

type AboutTabsProps = {
  /** «…талаар» табын нийтлэлийн самбар */
  board: Exclude<PostBoard, "home">;
  /** Үндсэн табын нэр — «Хандив», «Өглөг» */
  mainLabel: string;
  /** Үндсэн табын агуулга */
  children: React.ReactNode;
};

/**
 * Санхүүгийн хуудасны табууд: «…талаар» (нийтлэл оруулдаг самбар) ба
 * үндсэн агуулга. Хангамжийн «Хангамжийн талаар» табтай ижил — эхний таб нь
 * «талаар».
 */
export default function AboutTabs({ board, mainLabel, children }: AboutTabsProps) {
  const [active, setActive] = useState<"about" | "main">("about");
  const tabs = [
    { key: "about" as const, label: POST_BOARDS[board].label },
    { key: "main" as const, label: mainLabel },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label={mainLabel}
        className="flex flex-wrap gap-x-1 border-b border-gray-200 dark:border-white/10"
      >
        {tabs.map((item) => {
          const selected = item.key === active;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`${board}-tab-${item.key}`}
              aria-selected={selected}
              aria-controls={`${board}-panel-${item.key}`}
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

      <div role="tabpanel" id={`${board}-panel-${active}`} aria-labelledby={`${board}-tab-${active}`}>
        {active === "about" ? <PostFeed board={board} /> : children}
      </div>
    </div>
  );
}
