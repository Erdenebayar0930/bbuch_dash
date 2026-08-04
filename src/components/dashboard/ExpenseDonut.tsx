"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";

import { formatCurrency } from "@/data/finance";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

/** Ангиллын дарааллаар давтагдах өнгөний багц */
const palette = ["#12294a", "#2563eb", "#10b981", "#f59e0b", "#64748b"];

type ExpenseDonutProps = {
  items: { name: string; value: number; share: number }[];
};

export default function ExpenseDonut({ items }: ExpenseDonutProps) {
  const colors = useMemo(
    () => items.map((_, index) => palette[index % palette.length]),
    [items]
  );

  const options: ApexOptions = useMemo(
    () => ({
      chart: { type: "donut", fontFamily: "Outfit, sans-serif" },
      labels: items.map((item) => item.name),
      colors,
      legend: { show: false },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      plotOptions: {
        pie: { donut: { size: "68%", labels: { show: false } } },
      },
      tooltip: {
        y: { formatter: (value: number) => formatCurrency(value) },
      },
    }),
    [items, colors]
  );

  if (items.length === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center text-center text-theme-sm text-gray-500 dark:text-gray-400">
        Сонгосон хугацаанд зардал бүртгэгдээгүй байна.
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-center">
        <ReactApexChart
          options={options}
          series={items.map((item) => item.value)}
          type="donut"
          height={230}
        />
      </div>

      <ul className="mt-5 flex flex-col gap-3">
        {items.map((item, index) => (
          <li key={item.name} className="flex items-center gap-3">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colors[index] }}
              aria-hidden="true"
            />
            <span className="flex-1 truncate text-theme-sm text-gray-700 dark:text-gray-300">
              {item.name}
            </span>
            <span className="num text-theme-sm font-medium text-gray-800 dark:text-white/90">
              {item.share}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
