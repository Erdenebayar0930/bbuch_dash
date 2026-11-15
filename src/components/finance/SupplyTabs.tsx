"use client";

import React, { useState } from "react";
import { Construction } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import DisciplinePanel from "@/components/finance/DisciplinePanel";
import SupplyLedger from "@/components/finance/SupplyLedger";
import { isAdminRole } from "@/lib/permissions";

type TabKey = "about" | "church-supply" | "church-budget" | "discipline";

const TABS: { key: TabKey; label: string }[] = [
  { key: "about", label: "Хангамжийн талаар" },
  { key: "church-supply", label: "Чуулганы хангамж" },
  { key: "church-budget", label: "Чуулганы төсөв" },
  { key: "discipline", label: "Сахилгажуулалт" },
];

const PLACEHOLDER: Record<Exclude<TabKey, "church-supply" | "discipline">, string> = {
  about: "Хангамжийн тухай тайлбар мэдээлэл энд орно.",
  "church-budget": "Чуулганы төсвийн мэдээлэл энд орно.",
};

/**
 * Санхүү → Хангамж хуудасны табууд. «Чуулганы хангамж» нь орж ирсэн мөнгө,
 * эд зүйлсийн бүртгэл (`SupplyLedger`); бусад нь агуулга нь хараахан
 * тодорхойгүй. Хангамжийн аймгийн гишүүн (админ бус) зөвхөн Сахилгажуулалтыг харна.
 */
export default function SupplyTabs() {
  const { user } = useUser();
  // Админ бус (Хангамжийн аймгийн гишүүн) зөвхөн Сахилгажуулалтыг харна
  const isAdmin = isAdminRole(user?.role);
  const tabs = isAdmin ? TABS : TABS.filter((item) => item.key === "discipline");
  const [picked, setPicked] = useState<TabKey>("about");
  const active = tabs.some((item) => item.key === picked) ? picked : tabs[0].key;
  const setActive = setPicked;
  const tab = tabs.find((item) => item.key === active) ?? tabs[0];

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Хангамж"
        className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-white/10"
      >
        {tabs.map((item) => {
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
        ) : active === "discipline" ? (
          <DisciplinePanel />
        ) : (
          <div className="surface flex min-h-[320px] flex-col items-center justify-center gap-3 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500">
              <Construction className="h-6 w-6" strokeWidth={1.6} />
            </span>
            <p className="text-base font-medium text-gray-800 dark:text-white/90">
              {tab.label} — бэлтгэгдэж байна
            </p>
            <p className="max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
              {PLACEHOLDER[active as keyof typeof PLACEHOLDER]}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
