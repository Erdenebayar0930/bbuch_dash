"use client";

import React, { useState } from "react";
import { Construction } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import SupplyLedger from "@/components/finance/SupplyLedger";
import PostFeed from "@/components/posts/PostFeed";
import { isAdminRole } from "@/lib/permissions";

type TabKey = "about" | "church-supply" | "church-budget";

/**
 * `access` — хэн харах вэ (админ, супер админ бүгдийг харна):
 * - all: бүх хэрэглэгч
 * - aimag: аль нэг аймгийн гишүүн (`/api/supplies` GET нь `requireAimag`)
 *
 * Сахилгажуулалт нь Хангамжийн аймаг → Сахилгажуулалтын төлбөр
 * (`/aimag/supply/discipline`) рүү шилжсэн.
 */
type TabAccess = "all" | "aimag";

const TABS: { key: TabKey; label: string; access: TabAccess }[] = [
  { key: "about", label: "Хангамжийн талаар", access: "all" },
  { key: "church-supply", label: "Чуулганы хангамж", access: "aimag" },
  { key: "church-budget", label: "Чуулганы төсөв", access: "aimag" },
];

const PLACEHOLDER: Record<Exclude<TabKey, "church-supply" | "about">, string> = {
  "church-budget": "Чуулганы төсвийн мэдээлэл энд орно.",
};

/**
 * Санхүү → Хангамж хуудасны табууд. «Чуулганы хангамж» нь орж ирсэн мөнгө,
 * эд зүйлсийн бүртгэл (`SupplyLedger`); бусад нь агуулга нь хараахан
 * тодорхойгүй. Хуудас бүгдэд нээлттэй ч таб бүр `access`-ээрээ шүүгдэнэ.
 */
export default function SupplyTabs() {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);
  const userAimags = user?.aimags ?? [];
  const inAnyAimag = isAdmin || userAimags.length > 0;
  const tabs = TABS.filter(
    (item) =>
      item.access === "all" ||
      (item.access === "aimag" && inAnyAimag)
  );
  const [picked, setPicked] = useState<TabKey>("about");
  const active = tabs.some((item) => item.key === picked) ? picked : tabs[0].key;
  const setActive = setPicked;
  const tab = tabs.find((item) => item.key === active) ?? tabs[0];

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Хангамж"
        className="flex flex-wrap gap-x-1 border-b border-gray-200 dark:border-white/10"
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
        {active === "about" ? (
          <PostFeed board="supply" />
        ) : active === "church-supply" ? (
          <SupplyLedger canEdit={isAdmin} />
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
