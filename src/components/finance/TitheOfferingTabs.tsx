"use client";

import React, { useState } from "react";
import { Construction } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import GivingTracker from "@/components/finance/GivingTracker";
import StatementImport from "@/components/finance/StatementImport";
import TitheAccountCard from "@/components/finance/TitheAccountCard";
import { isAdminRole } from "@/lib/permissions";

type TabKey = "about" | "guide" | "giving";

/** Хуудас бүрийн нэршил — 1/10 ба өргөл, Газрын 1/10 хоёр ижил загвартай */
const VARIANTS = {
  tithe: { title: "1/10 ба өргөл", about: "1/10 ба өргөлийн талаар" },
  land: { title: "Газрын 1/10", about: "Газрын 1/10-ийн талаар" },
} as const;

type TitheOfferingTabsProps = {
  /** `tithe` — 1/10 ба өргөл, `land` — Газрын 1/10 */
  variant?: keyof typeof VARIANTS;
};

/** «Бэлтгэгдэж байна» хоосон төлөв */
function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <div className="surface flex min-h-[320px] flex-col items-center justify-center gap-3 p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500">
        <Construction className="h-6 w-6" strokeWidth={1.6} />
      </span>
      <p className="text-base font-medium text-gray-800 dark:text-white/90">{title}</p>
      <p className="max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  );
}

/**
 * Санхүү → 1/10 ба өргөл / Газрын 1/10 хуудасны табууд.
 *
 * • …-ийн талаар — тайлбар мэдээлэл (агуулга нь хараахан тодорхойгүй)
 * • Өргөх заавар — өргөх данс ба гүйлгээний утгыг хуулах (бүгдэд)
 * • Өргөж буй байдал — зөвхөн админд. Нэрс × сарууд, сар бүр өргөсөн эсэхийг
 *   чагтална (`GivingTracker`, хуудас бүрт тусдаа жагсаалт). 1/10 ба өргөлд
 *   доор нь банкны хуулга уншдаг хэсэг (`StatementImport`).
 */
export default function TitheOfferingTabs({ variant = "tithe" }: TitheOfferingTabsProps) {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);
  const names = VARIANTS[variant];

  const tabs: { key: TabKey; label: string }[] = [
    { key: "about", label: names.about },
    { key: "guide", label: "Өргөх заавар" },
    // Хуулгын API нь зөвхөн админд — бусдад таб нь ч гарахгүй
    ...(isAdmin ? [{ key: "giving" as const, label: "Өргөж буй байдал" }] : []),
  ];

  const [selected, setActive] = useState<TabKey>("about");
  // Эрхгүй таб сонгогдсон хэвээр үлдэхгүй
  const active = tabs.some((tab) => tab.key === selected) ? selected : "about";

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label={names.title}
        className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-white/10"
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
          // Сар бүр өргөсөн эсэхийн чагт; 1/10 дээр хуулга уншдаг хэсэг доор нь
          <div className="flex flex-col gap-5">
            <GivingTracker board={variant} />
            {variant === "tithe" && <StatementImport />}
          </div>
        ) : (
          <Placeholder
            title={`${names.about} — бэлтгэгдэж байна`}
            text={`${names.title}-ийн тухай тайлбар мэдээлэл энд орно. Дансны мэдээлэл «Өргөх заавар» хэсэгт байна.`}
          />
        )}
      </div>
    </div>
  );
}
