"use client";

import React, { useState } from "react";
import { Landmark } from "lucide-react";

import { bankBadges, bankLabel, bankLogos, isBank } from "@/data/donationAccounts";

type BankLogoProps = {
  /** `bankNames` доторх түлхүүр (khan, state) */
  bank: string;
  className?: string;
};

/**
 * Банкны лого. `public/images/banks/` дотор файл байвал түүнийг, үгүй бол
 * (эсвэл ачаалж чадаагүй бол) банкны өнгөтэй товчилсон тэмдэг харуулна.
 */
export default function BankLogo({ bank, className = "h-12 w-12" }: BankLogoProps) {
  const [failed, setFailed] = useState(false);

  if (!isBank(bank)) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-white/10 ${className}`}
      >
        <Landmark className="h-1/2 w-1/2" strokeWidth={1.6} />
      </span>
    );
  }

  if (failed) {
    const badge = bankBadges[bank];
    return (
      <span
        role="img"
        aria-label={bankLabel(bank)}
        style={{ backgroundColor: badge.color }}
        className={`flex shrink-0 items-center justify-center rounded-xl text-theme-sm font-bold text-white ${className}`}
      >
        {badge.short}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- жижиг статик лого, алдаа гарвал тэмдэг рүү шилжинэ
    <img
      src={bankLogos[bank]}
      alt={bankLabel(bank)}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-xl bg-white object-contain ${className}`}
    />
  );
}
