"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";

import { formatCompact } from "@/data/finance";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export const revenueSeriesColors = {
  income: "#3b82f6",
  expense: "#1b355e",
  profit: "#10b981",
};

type RevenueChartProps = {
  categories: string[];
  income: number[];
  expense: number[];
  profit: number[];
};

export default function RevenueChart({
  categories,
  income,
  expense,
  profit,
}: RevenueChartProps) {
  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "area",
        height: 320,
        fontFamily: "Outfit, sans-serif",
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { speed: 500 },
      },
      colors: [
        revenueSeriesColors.income,
        revenueSeriesColors.expense,
        revenueSeriesColors.profit,
      ],
      stroke: { curve: "smooth", width: 2 },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.18,
          opacityTo: 0,
          stops: [0, 90, 100],
        },
      },
      dataLabels: { enabled: false },
      markers: { size: 0, hover: { size: 5 } },
      legend: { show: false },
      grid: {
        borderColor: "#f1f3f7",
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { left: 8, right: 8, top: -8 },
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false },
        labels: { style: { fontSize: "12px" } },
      },
      yaxis: {
        labels: {
          style: { fontSize: "12px" },
          formatter: (value: number) => `${(value / 1_000_000).toFixed(0)}M`,
        },
      },
      tooltip: {
        shared: true,
        intersect: false,
        y: { formatter: (value: number) => formatCompact(value) },
      },
    }),
    [categories]
  );

  const series = useMemo(
    () => [
      { name: "Орлого", data: income },
      { name: "Зарлага", data: expense },
      { name: "Ашиг", data: profit },
    ],
    [income, expense, profit]
  );

  return (
    <div className="-ml-2 min-h-[320px]">
      <ReactApexChart
        options={options}
        series={series}
        type="area"
        height={320}
      />
    </div>
  );
}
