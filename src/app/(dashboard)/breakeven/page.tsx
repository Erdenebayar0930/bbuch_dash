"use client";

import React, { useMemo, useState } from "react";
import { Download } from "lucide-react";

import BreakEvenChart from "@/components/dashboard/BreakEvenChart";
import Panel from "@/components/dashboard/Panel";
import StatCard from "@/components/dashboard/StatCard";
import {
  calculateBreakEven,
  generateBreakEvenChartData,
  formatCompact,
  formatCurrency,
  filterByPeriod,
  latestPeriod,
  periodLabel,
  yearsFrom,
  type Period,
} from "@/data/finance";
import { useTransactions } from "@/hooks/useTransactions";

export default function BreakevenPage() {
  const { items, loading, error } = useTransactions();

  // Сонголт хийгээгүй үед хамгийн сүүлийн гүйлгээтэй үеийг харуулна
  const [picked, setPicked] = useState<Period | null>(null);
  const { year, month } = picked ?? latestPeriod(items);

  const years = useMemo(() => yearsFrom(items, year), [items, year]);
  const periodItems = useMemo(
    () => filterByPeriod(items, year, month),
    [items, year, month]
  );

  const metrics = useMemo(() => calculateBreakEven(periodItems), [periodItems]);
  const chartData = useMemo(
    () => generateBreakEvenChartData(metrics, periodItems),
    [metrics, periodItems]
  );

  const label = periodLabel(year, month);

  return (
    <div className="flex flex-col gap-5">
      {/* Хуудасны толгой */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Хугарлын цэг шинжилгээ
          </h1>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            {loading
              ? "Ачаалж байна..."
              : `${label} — тогтмол ба хувьсах зардлын шинжилгээ`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/10"
          >
            <Download className="h-4 w-4" strokeWidth={1.8} />
            Татаж авах
          </button>
        </div>
      </div>

      {/* Үзүүлэлтүүдийн картууд */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Төгтмөл зардал"
          value={formatCompact(metrics.fixedCosts)}
          tone="neutral"
        />
        <StatCard
          label="Нэгжийн хувьсах зардал"
          value={formatCompact(metrics.variableCostPerUnit)}
          tone="neutral"
        />
        <StatCard
          label="Хугарлын цэг (нэгж)"
          value={`${metrics.breakEvenUnits} ш`}
          tone="accent"
        />
        <StatCard
          label="Хугарлын орлого"
          value={formatCompact(metrics.breakEvenRevenue)}
          tone="success"
        />
      </div>

      {/* Гол график */}
      <Panel
        title="Орлого ба зардлын огтлолцол"
        subtitle={`Хугарлын цэг: ${metrics.breakEvenUnits} нэгж`}
      >
        <BreakEvenChart
          units={chartData.units}
          revenue={chartData.revenue}
          fixedCost={chartData.fixedCosts}
          variableCost={chartData.variableCosts}
        />
      </Panel>

      {/* Нэмэлт мэдээлэл */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Үзүүлэлтүүдийн дэлгэрэнгүй */}
        <Panel
          title="Үзүүлэлтүүд"
          className="col-span-1"
          bodyClassName="px-5 pb-5"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 dark:bg-white/5">
              <span className="text-theme-sm font-medium text-gray-600 dark:text-gray-400">
                Нэгжийн үнэ
              </span>
              <span className="num text-theme-sm font-semibold text-gray-900 dark:text-white">
                {formatCurrency(metrics.pricePerUnit)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 dark:bg-white/5">
              <span className="text-theme-sm font-medium text-gray-600 dark:text-gray-400">
                Хувь нэмэр маржин
              </span>
              <span className="num text-theme-sm font-semibold text-gray-900 dark:text-white">
                {formatCurrency(
                  metrics.pricePerUnit - metrics.variableCostPerUnit
                )}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 dark:bg-white/5">
              <span className="text-theme-sm font-medium text-gray-600 dark:text-gray-400">
                Аюулгүй маржин
              </span>
              <span className="num text-theme-sm font-semibold text-gray-900 dark:text-white">
                {formatCurrency(metrics.safetyMargin)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 dark:bg-white/5">
              <span className="text-theme-sm font-medium text-gray-600 dark:text-gray-400">
                Аюулгүй маржин %
              </span>
              <span className="num text-theme-sm font-semibold text-success-600 dark:text-success-400">
                {metrics.marginOfSafetyPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </Panel>

        {/* Мэдээлэл */}
        <Panel
          title="Дүгнэлт"
          className="col-span-1"
          bodyClassName="px-5 pb-5"
        >
          <div className="rounded-lg border border-accent-200 bg-accent-50 p-4 dark:border-accent-900/30 dark:bg-accent-900/20">
            <div className="mb-3 flex items-start gap-2">
              <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-accent-600 dark:bg-accent-400" />
              <div>
                <h4 className="text-theme-sm font-semibold text-accent-900 dark:text-accent-100">
                  Та энэ сарын борлуулалтаас {metrics.marginOfSafetyPercent.toFixed(1)}% нь аюулгүй
                </h4>
                <p className="mt-1 text-theme-xs text-accent-800 dark:text-accent-200">
                  Хугарлын цэгийнхээс {metrics.breakEvenUnits} нэгжээр дээгүүр байна
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
