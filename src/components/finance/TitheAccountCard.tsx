"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import BankLogo from "@/components/finance/BankLogo";
import {
  LAND_TITHE_ACCOUNT,
  bankLabel,
  formatAccountNumber,
} from "@/data/donationAccounts";
import { OFFERING, TITHE } from "@/data/titheOptions";
import { useDonationAccounts } from "@/hooks/useDonationAccounts";
import { copyToClipboard } from "@/lib/clipboard";

/** "Хуулагдлаа" тэмдэглэгээ хэдэн миллисекунд харагдах вэ */
const COPIED_MS = 2000;

/**
 * Гүйлгээний утганд бичих системийн нэр — «Г.Мөнгөнцэцэг» хэлбэр:
 * эцгийн нэрийн (`last_name`) эхний үсэг + цэг + нэр (`first_name`).
 */
export function systemName(firstName?: string, lastName?: string): string {
  const first = (firstName ?? "").trim();
  const initial = (lastName ?? "").trim().charAt(0).toUpperCase();
  if (!first) return initial ? `${initial}.` : "";
  return initial ? `${initial}.${first}` : first;
}

type CopyLineProps = {
  /** Мөрийн өмнөх жижиг тайлбар (заавал биш) */
  hint?: string;
  /** Дэлгэцэнд харагдах утга */
  display: string;
  /** Хуулагдах утга — заагаагүй бол `display` */
  value?: string;
  mono?: boolean;
  copied: boolean;
  onCopy: (value: string) => void;
};

/** Нэг утга ба түүнийг хуулах товч — нэг мөрөнд */
export function CopyLine({ hint, display, value, mono, copied, onCopy }: CopyLineProps) {
  const text = value ?? display;

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        {hint && <p className="text-theme-xs text-gray-500 dark:text-gray-400">{hint}</p>}
        <p
          className={`break-all text-base font-semibold text-gray-900 dark:text-white ${
            mono ? "font-mono tracking-wide" : ""
          }`}
        >
          {display}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onCopy(text)}
        aria-label={`${hint ?? display} хуулах`}
        className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-theme-xs font-medium transition-colors ${
          copied
            ? "bg-success-500/15 text-success-700 dark:text-success-400"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15"
        }`}
      >
        {copied ? (
          <Check className="h-4 w-4" strokeWidth={2.2} />
        ) : (
          <Copy className="h-4 w-4" strokeWidth={1.8} />
        )}
        {copied ? "Хуулагдлаа" : "Хуулах"}
      </button>
    </div>
  );
}

/**
 * 1/10 ба өргөл өргөх данс — нэг картад нэгтгэсэн: банкны лого, нэр,
 * хүлээн авагч; доор нь «Дансны дугаар», «Гүйлгээний утга» хуулах мөрүүд.
 *
 * Данс нь `donation_accounts`-аас («1/10 ба өргөл» гэж тэмдэглэсэн, `isTithe`)
 * уншигдана — админ солиход код өөрчлөх шаардлагагүй. Гүйлгээний утга нь
 * «1/10-<системийн нэр>», «Өргөл-<системийн нэр>»: хуулга уншихад «1/10»
 * загвараар 1/10, бусдыг өргөл гэж ангилна (@see data/titheOptions.ts).
 */
type TitheAccountCardProps = {
  /**
   * `tithe` — 1/10 ба өргөл (`isTithe` данс, хоёр төрлийн утга),
   * `land` — Газрын 1/10 (`LAND_TITHE_ACCOUNT`, нэг төрлийн утга)
   */
  variant?: "tithe" | "land";
};

export default function TitheAccountCard({ variant = "tithe" }: TitheAccountCardProps) {
  const { user } = useUser();
  const { accounts, loading } = useDonationAccounts();
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const isLand = variant === "land";
  const account = isLand
    ? (accounts.find((item) => item.number === LAND_TITHE_ACCOUNT.number) ??
      (loading ? null : { ...LAND_TITHE_ACCOUNT }))
    : (accounts.find((item) => item.isTithe) ?? null);
  const name = systemName(user?.first_name, user?.last_name);

  const copy = async (value: string) => {
    const ok = await copyToClipboard(value);
    setFailed(!ok);
    if (ok) {
      setCopied(value);
      window.setTimeout(
        () => setCopied((current) => (current === value ? null : current)),
        COPIED_MS
      );
    }
  };

  /** Гүйлгээний утгын төрлүүд — өнгөөр нь ялгаж зэрэгцүүлнэ */
  const kinds = isLand
    ? [
        {
          label: "Газрын 1/10",
          hint: "Газрын аравны нэгээ өргөхөд",
          memo: `Газрын ${TITHE}-${name}`,
          box: "border-warning-200 bg-warning-50/60 dark:border-warning-500/30 dark:bg-warning-500/10",
          badge: "bg-warning-600 text-white",
        },
      ]
    : [
        {
          label: TITHE,
          hint: "Аравны нэгээ өргөхөд",
          memo: `${TITHE}-${name}`,
          box: "border-accent-200 bg-accent-50/60 dark:border-accent-500/30 dark:bg-accent-500/10",
          badge: "bg-accent-600 text-white",
        },
        {
          label: OFFERING,
          hint: "Өргөл өргөхөд",
          memo: `${OFFERING}-${name}`,
          box: "border-success-200 bg-success-50/60 dark:border-success-500/30 dark:bg-success-500/10",
          badge: "bg-success-600 text-white",
        },
      ];

  if (loading && !account) {
    return (
      <div className="surface p-6 text-theme-sm text-gray-500 dark:text-gray-400">
        Ачаалж байна...
      </div>
    );
  }

  if (!account) {
    return (
      <div className="surface p-6">
        <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-theme-sm text-gray-400 dark:border-white/10">
          {isLand ? "Газрын 1/10-ийн" : "1/10 ба өргөлийн"} данс бүртгэгдээгүй байна.
        </p>
      </div>
    );
  }

  return (
    <div className="surface mx-auto w-full max-w-2xl overflow-hidden">
      {/* Банк ба хүлээн авагч */}
      <div className="flex items-center gap-4 p-5">
        <BankLogo bank={account.bank} />
        <div className="min-w-0">
          <p className="text-base font-semibold text-gray-900 dark:text-white">
            {bankLabel(account.bank) || account.title}
          </p>
          {account.holder && (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">{account.holder}</p>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 p-5 dark:border-white/5">
        <p className="mb-1.5 text-theme-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Дансны дугаар
        </p>
        <CopyLine
          display={formatAccountNumber(account.number)}
          value={account.number}
          mono
          copied={copied === account.number}
          onCopy={copy}
        />
      </div>

      <div className="border-t border-gray-100 p-5 dark:border-white/5">
        <p className="mb-1.5 text-theme-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Гүйлгээний утга
        </p>

        {name ? (
          // Хоёр төрөл андуурагдахгүйн тулд өөр өнгөтэй, тусдаа хайрцагт зэрэгцэнэ
          <div className={`grid gap-3 ${kinds.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {kinds.map((kind) => (
              <div key={kind.label} className={`rounded-xl border p-4 ${kind.box}`}>
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-theme-xs font-bold ${kind.badge}`}
                  >
                    {kind.label}
                  </span>
                  <span className="text-theme-xs text-gray-600 dark:text-gray-400">
                    {kind.hint}
                  </span>
                </div>
                <CopyLine
                  display={kind.memo}
                  copied={copied === kind.memo}
                  onCopy={copy}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-warning-50 px-4 py-3 text-theme-sm text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
            Профайлд нэрээ бөглөсний дараа гүйлгээний утга энд гарна.
          </p>
        )}

        <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
          Гүйлгээний утгыг яг ингэж бичвэл таны{" "}
          {isLand ? "газрын 1/10" : "1/10 ба өргөл"} системд зөв бүртгэгдэнэ.
        </p>

        {failed && (
          <p role="status" className="mt-2 text-theme-xs text-error-500">
            Хуулж чадсангүй — утгыг гараар бичнэ үү.
          </p>
        )}
      </div>
    </div>
  );
}
