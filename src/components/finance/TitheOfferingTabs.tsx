"use client";

import React, { useState } from "react";
import { Construction } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import StatementImport from "@/components/finance/StatementImport";
import TitheAccountCard from "@/components/finance/TitheAccountCard";
import { isAdminRole } from "@/lib/permissions";

type TabKey = "about" | "guide" | "giving";

const TABS: { key: TabKey; label: string; adminOnly?: boolean }[] = [
  { key: "about", label: "1/10 ба өргөлийн талаар" },
  { key: "guide", label: "Өргөх заавар" },
  // Хуулгын API нь зөвхөн админд — бусдад таб нь ч гарахгүй
  { key: "giving", label: "Өргөж буй байдал", adminOnly: true },
];

/**
 * Санхүү → 1/10 ба өргөл хуудасны табууд.
 *
 * • 1/10 ба өргөлийн талаар — тайлбар мэдээлэл (агуулга нь хараахан тодорхойгүй)
 * • Өргөх заавар — өргөх данс ба гүйлгээний утгыг хуулах (бүгдэд)
 * • Өргөж буй байдал — банкны хуулгыг уншиж 1/10, өргөлийг ялгах
 *   (`StatementImport`, өмнөх «Хуваарилалт» хуудас) — зөвхөн админд
 */
export default function TitheOfferingTabs() {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);
  const tabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);

  const [selected, setActive] = useState<TabKey>("about");
  // Эрхгүй таб сонгогдсон хэвээр үлдэхгүй
  const active = tabs.some((tab) => tab.key === selected) ? selected : "about";

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="1/10 ба өргөл"
        className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-white/10"
      >
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`tithe-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`tithe-panel-${tab.key}`}
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

      <div role="tabpanel" id={`tithe-panel-${active}`} aria-labelledby={`tithe-tab-${active}`}>
        {active === "giving" ? (
          <StatementImport />
        ) : active === "guide" ? (
          <TitheAccountCard />
        ) : (
          <div className="surface flex min-h-[320px] flex-col items-center justify-center gap-3 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500">
              <Construction className="h-6 w-6" strokeWidth={1.6} />
            </span>
            <p className="text-base font-medium text-gray-800 dark:text-white/90">
              1/10 ба өргөлийн талаар — бэлтгэгдэж байна
            </p>
            <p className="max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
              1/10 ба өргөлийн тухай тайлбар мэдээлэл энд орно. Дансны мэдээлэл
              «Өргөх заавар» хэсэгт байна.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
