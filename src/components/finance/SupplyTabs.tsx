"use client";

import React, { useState } from "react";
import { Construction } from "lucide-react";

import SupplyLedger from "@/components/finance/SupplyLedger";

type TabKey = "about" | "church-supply" | "church-budget";

const TABS: { key: TabKey; label: string }[] = [
  { key: "about", label: "Хангамжийн талаар" },
  { key: "church-supply", label: "Чуулганы хангамж" },
  { key: "church-budget", label: "Чуулганы төсөв" },
];

const PLACEHOLDER: Record<Exclude<TabKey, "church-supply">, string> = {
  about: "Хангамжийн тухай тайлбар мэдээлэл энд орно.",
  "church-budget": "Чуулганы төсвийн мэдээлэл энд орно.",
};

/**
 * Санхүү → Хангамж хуудасны табууд. «Чуулганы хангамж» нь орж ирсэн мөнгө,
 * эд зүйлсийн бүртгэл (`SupplyLedger`); бусад нь агуулга нь хараахан
 * тодорхойгүй. Цэс нь зөвхөн админд.
 */
export default function SupplyTabs() {
  const [active, setActive] = useState<TabKey>("about");
  const tab = TABS.find((item) => item.key === active) ?? TABS[0];

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Хангамж"
        className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-white/10"
      >
        {TABS.map((item) => {
          const selected = item.key === active;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`supply-tab-${item.key}`}
              aria-selected={selected}
              aria-controls={`supply-panel-${item.key}`}
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

      <div role="tabpanel" id={`supply-panel-${active}`} aria-labelledby={`supply-tab-${active}`}>
        {active === "church-supply" ? (
          <SupplyLedger />
        ) : (
          <div className="surface flex min-h-[320px] flex-col items-center justify-center gap-3 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500">
              <Construction className="h-6 w-6" strokeWidth={1.6} />
            </span>
            <p className="text-base font-medium text-gray-800 dark:text-white/90">
              {tab.label} — бэлтгэгдэж байна
            </p>
            <p className="max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
              {PLACEHOLDER[active]}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
