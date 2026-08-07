"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Download, SlidersHorizontal } from "lucide-react";

import ExpenseDonut from "@/components/dashboard/ExpenseDonut";
import Panel from "@/components/dashboard/Panel";
import RevenueChart, {
  revenueSeriesColors,
} from "@/components/dashboard/RevenueChart";
import StatCard from "@/components/dashboard/StatCard";
import PeriodFilter from "@/components/finance/PeriodFilter";
import TransactionsTable from "@/components/finance/TransactionsTable";
import {
  expenseByCategory,
  filterByPeriod,
  formatCompact,
  formatPercent,
  latestPeriod,
  monthlyTotals,
  percentChange,
  periodLabel,
  previousPeriod,
  summarize,
  yearsFrom,
  type Period,
} from "@/data/finance";
import { useTransactions } from "@/hooks/useTransactions";

const chartLegend = [
  { name: "Орлого", color: revenueSeriesColors.income },
  { name: "Зарлага", color: revenueSeriesColors.expense },
  { name: "Ашиг", color: revenueSeriesColors.profit },
];

export default function Dashboard() {
  const { items, loading, error } = useTransactions();

  // Сонголт хийгээгүй үед хамгийн сүүлийн гүйлгээтэй үеийг харуулна
  const [picked, setPicked] = useState<Period | null>(null);
  const { year, month } = picked ?? latestPeriod(items);

  const years = useMemo(() => yearsFrom(items, year), [items, year]);
  const periodItems = useMemo(
    () => filterByPeriod(items, year, month),
    [items, year, month]
  );
  const totals = useMemo(() => summarize(periodItems), [periodItems]);

  // Өмнөх үетэй харьцуулах өгөгдөл
  const previous = useMemo(() => {
    const { year: prevYear, month: prevMonth } = previousPeriod(year, month);
    const list = filterByPeriod(items, prevYear, prevMonth);
    return list.length > 0 ? summarize(list) : null;
  }, [items, year, month]);

  const months = useMemo(() => monthlyTotals(items, year), [items, year]);
  const breakdown = useMemo(() => expenseByCategory(periodItems), [periodItems]);
  const recent = useMemo(() => periodItems.slice(0, 6), [periodItems]);

  const label = periodLabel(year, month);
  const trendLabel =
    months.length > 0
      ? `${year} оны ${months[0].month}–${months[months.length - 1].month}-р сар`
      : `${year} он`;

  const incomeChange = previous
    ? percentChange(totals.income, previous.income)
    : null;
  const expenseChange = previous
    ? percentChange(totals.expense, previous.expense)
    : null;
  const netChange = previous ? percentChange(totals.net, previous.net) : null;
  const marginChange = previous ? totals.margin - previous.margin : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Хуудасны толгой */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Үндсэн цэс
          </h1>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            {loading ? "Ачаалж байна..." : `${label} — санхүүгийн тойм`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/transactions"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/10"
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
            Дэлгэрэнгүй
          </Link>
          <button
            type="button"
            disabled
            title="Тайлан татах хэсэг бэлтгэгдэж байна"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-3.5 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Download className="h-4 w-4" strokeWidth={1.8} />
            Тайлан татах
          </button>
        </div>
      </div>

      {error && (
        <div className="surface border-error-200 bg-error-50 p-4 text-theme-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
          Өгөгдөл унших үед алдаа гарлаа. Холболтоо шалгаад дахин оролдоно уу.
        </div>
      )}

      {/* Хугацааны шүүлтүүр */}
      <PeriodFilter
        years={years}
        year={year}
        month={month}
        onYearChange={(value) => setPicked({ year: value, month })}
        onMonthChange={(value) => setPicked({ year, month: value })}
        summary={
          loading ? "Ачаалж байна..." : `${label} · ${periodItems.length} гүйлгээ`
        }
      />

      {/* Үндсэн үзүүлэлтүүд */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Нийт орлого"
          value={formatCompact(totals.income)}
          tone="accent"
          delta={incomeChange === null ? undefined : formatPercent(incomeChange)}
          deltaUp={(incomeChange ?? 0) >= 0}
        />
        <StatCard
          label="Нийт зарлага"
          value={formatCompact(totals.expense)}
          delta={
            expenseChange === null ? undefined : formatPercent(expenseChange)
          }
          deltaUp={(expenseChange ?? 0) >= 0}
          deltaPositive={(expenseChange ?? 0) < 0}
        />
        <StatCard
          label="Цэвэр ашиг"
          value={formatCompact(totals.net)}
          tone={totals.net >= 0 ? "success" : "neutral"}
          delta={netChange === null ? undefined : formatPercent(netChange)}
          deltaUp={(netChange ?? 0) >= 0}
        />
        <StatCard
          label="Ашгийн маржин"
          value={`${totals.margin.toFixed(1)}%`}
          delta={
            marginChange === null
              ? undefined
              : formatPercent(marginChange, "pp")
          }
          deltaUp={(marginChange ?? 0) >= 0}
        />
      </div>

      {/* Графикууд */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Орлого / Зарлага / Ашиг"
          subtitle={trendLabel}
          action={
            <ul className="flex flex-wrap items-center gap-4">
              {chartLegend.map((item) => (
                <li
                  key={item.name}
                  className="flex items-center gap-2 text-theme-xs text-gray-600 dark:text-gray-300"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                  {item.name}
                </li>
              ))}
            </ul>
          }
        >
          <RevenueChart
            categories={months.map((item) => `${item.month}-р сар`)}
            income={months.map((item) => item.income)}
            expense={months.map((item) => item.expense)}
            profit={months.map((item) => item.net)}
          />
        </Panel>

        <Panel title="Зардлын бүтэц" subtitle={label}>
          <ExpenseDonut items={breakdown} />
        </Panel>
      </div>

      {/* Сүүлийн гүйлгээ */}
      <Panel
        title="Сүүлийн гүйлгээ"
        subtitle={label}
        bodyClassName="pb-2"
        action={
          <Link
            href="/transactions"
            className="inline-flex items-center gap-1 text-theme-sm font-medium text-accent-600 transition-colors hover:text-accent-700 dark:text-accent-400"
          >
            Бүгдийг харах
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        }
      >
        <TransactionsTable items={recent} compact />
      </Panel>
    </div>
  );
}
