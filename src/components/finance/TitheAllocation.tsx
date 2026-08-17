"use client";

import React, { useMemo, useState } from "react";
import { FileSpreadsheet, X } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import ExpenseDonut from "@/components/dashboard/ExpenseDonut";
import Panel from "@/components/dashboard/Panel";
import PeriodFilter from "@/components/finance/PeriodFilter";
import StatementImport from "@/components/finance/StatementImport";
import SummaryTile from "@/components/finance/SummaryTile";
import { useDonationAccounts } from "@/hooks/useDonationAccounts";
import { isAdminRole } from "@/lib/permissions";
import {
  expenseByCategory,
  filterByPeriod,
  formatCompact,
  formatCurrency,
  latestPeriod,
  periodLabel,
  summarize,
  yearsFrom,
  type Period,
} from "@/data/finance";
import { useTransactions } from "@/hooks/useTransactions";

/** Хуваарилалтын бүтцэд тусад нь харуулах ангиллын дээд тоо */
const TOP_CATEGORIES = 5;

/** Донатын өнгөтэй таарна — жагсаалт ба график нэг дарааллаар уншигдана */
const palette = ["#12294a", "#2563eb", "#10b981", "#f59e0b", "#64748b"];

/**
 * «1/10 ба өргөл» дансны хуваарилалт.
 *
 * Цугласан өргөл хаашаа зарцуулагдсаныг ангиллаар нь задалж харуулна.
 * Хуваарилалт гэдгийг ЗАРЛАГЫН бүтцээр хэмжинэ: тухайн данснаас гарсан
 * гүйлгээ бүр ямар нэг ангилалд хамаарах тул тэдгээрийн эзлэх хувь нь
 * мөнгө хаашаа явсны бодит зураг болно.
 *
 * Гүйлгээ нэмэх, засах нь /ledger хуудсанд — энд зөвхөн тайлан.
 */
export default function TitheAllocation() {
  const { items, loading, error } = useTransactions();
  const { accounts, loading: accountsLoading } = useDonationAccounts();
  const { user } = useUser();

  // Хуулга уншуулах нь гүйлгээ БИЧИХ үйлдэл — сервер тал ч админ эсэхийг
  // шалгадаг. Энгийн хэрэглэгчид товчийг огт харуулахгүй: дарвал заавал
  // 403 авах товч харуулах нь төөрөгдөл л үүсгэнэ.
  const isAdmin = isAdminRole(user?.role);
  const [importing, setImporting] = useState(false);

  // Аль данс нь «1/10 ба өргөл» болохыг админ тэмдэглэдэг — кодод хатуу
  // бичихгүй, эс бөгөөс дугаар өөрчлөгдөхөд хуудас чимээгүй хоосорно
  const titheAccount = useMemo(
    () => accounts.find((item) => item.isTithe) ?? null,
    [accounts]
  );

  const accountItems = useMemo(
    () =>
      titheAccount
        ? items.filter((item) => item.account === titheAccount.number)
        : [],
    [items, titheAccount]
  );

  const [picked, setPicked] = useState<Period | null>(null);
  const { year, month } = picked ?? latestPeriod(accountItems);

  const years = useMemo(
    () => yearsFrom(accountItems, year),
    [accountItems, year]
  );
  const periodItems = useMemo(
    () => filterByPeriod(accountItems, year, month),
    [accountItems, year, month]
  );

  const totals = useMemo(() => summarize(periodItems), [periodItems]);
  const breakdown = useMemo(
    () => expenseByCategory(periodItems, TOP_CATEGORIES),
    [periodItems]
  );

  const label = periodLabel(year, month);

  if (loading || accountsLoading) {
    return (
      <div className="surface flex min-h-[220px] items-center justify-center text-theme-sm text-gray-500 dark:text-gray-400">
        Ачаалж байна...
      </div>
    );
  }

  if (!titheAccount) {
    return (
      <div className="surface flex min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-base font-medium text-gray-800 dark:text-white/90">
          1/10 данс тэмдэглэгдээгүй байна
        </p>
        <p className="max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
          Админ «Дансны тохиргоо» хэсэгт аль данс нь 1/10 ба өргөлийнх болохыг
          тэмдэглэсний дараа энэ тайлан гарна.
        </p>
      </div>
    );
  }

  if (!titheAccount.canView) {
    return (
      <div className="surface flex min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-base font-medium text-gray-800 dark:text-white/90">
          Энэ дансны эрх танд алга
        </p>
        <p className="max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
          «{titheAccount.title}» дансны гүйлгээг харахын тулд админд хандана уу.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="surface border-error-200 bg-error-50 p-4 text-theme-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
          Гүйлгээ унших үед алдаа гарлаа. Холболтоо шалгаад дахин оролдоно уу.
        </div>
      )}

      {/*
        Хуулга уншуулах нь энэ хуудсанд ЗӨВХӨН админд харагдана. Нээлттэй
        байхад тайлан доор нь хэвээр үлдэнэ — оруулсны дараа дүн шинэчлэгдсэн
        эсэхийг тэр дороо харах боломжтой.
      */}
      {isAdmin && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setImporting((open) => !open)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700"
          >
            {importing ? (
              <>
                <X className="h-4 w-4" strokeWidth={2} />
                Хаах
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4" strokeWidth={2} />
                Excel оруулах
              </>
            )}
          </button>
        </div>
      )}

      {isAdmin && importing && <StatementImport />}

      <PeriodFilter
        years={years}
        year={year}
        month={month}
        onYearChange={(value) => setPicked({ year: value, month })}
        onMonthChange={(value) => setPicked({ year, month: value })}
        summary={`${label} · ${periodItems.length} гүйлгээ`}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <SummaryTile
          tone="income"
          label="Цугласан"
          value={formatCompact(totals.income)}
          caption={label}
        />
        <SummaryTile
          tone="expense"
          label="Хуваарилсан"
          value={formatCompact(totals.expense)}
          caption={label}
        />
        <SummaryTile
          tone="net"
          label="Үлдэгдэл"
          value={formatCompact(totals.net)}
          caption={label}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Panel
          className="lg:col-span-2"
          title="Хуваарилалтын бүтэц"
          subtitle={label}
        >
          <ExpenseDonut items={breakdown} />
        </Panel>

        <Panel
          className="lg:col-span-3"
          title="Ангилал тус бүрээр"
          subtitle={`«${titheAccount.title}» данснаас гарсан зарцуулалт`}
        >
          {breakdown.length === 0 ? (
            <p className="flex min-h-[180px] items-center justify-center text-center text-theme-sm text-gray-500 dark:text-gray-400">
              Сонгосон хугацаанд энэ данснаас зарцуулалт бүртгэгдээгүй байна.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {breakdown.map((entry, index) => (
                <li key={entry.name}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                      {entry.name}
                    </span>
                    <span className="num shrink-0 text-theme-sm text-gray-600 dark:text-gray-400">
                      {formatCurrency(entry.value)}
                      <span className="ml-2 text-gray-400">{entry.share}%</span>
                    </span>
                  </div>

                  {/* Хувийг нүдээр жиших — тоо уншихаас хурдан */}
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${entry.share}%`,
                        backgroundColor: palette[index % palette.length],
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
