"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";

import { formatCompact } from "@/data/finance";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

type BreakEvenChartProps = {
  units: number[];
  revenue: number[];
  fixedCost: number[];
  variableCost: number[];
};

export default function BreakEvenChart({
  units,
  revenue,
  fixedCost,
  variableCost,
}: BreakEvenChartProps) {
  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "line",
        height: 320,
        fontFamily: "Outfit, sans-serif",
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { speed: 500 },
      },
      colors: ["#3b82f6", "#ef4444", "#8b5cf6"],
      stroke: {
        curve: "smooth",
        width: [2, 2, 2],
        dashArray: [0, 4, 0],
      },
      dataLabels: { enabled: false },
      markers: { size: 5, hover: { size: 7 } },
      legend: { show: false },
      grid: {
        borderColor: "#f1f3f7",
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { left: 8, right: 8, top: -8 },
      },
      xaxis: {
        categories: units.map((u) => u.toString()),
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
    [units]
  );

  const series = useMemo(
    () => [
      { name: "Орлого", data: revenue },
      { name: "Нийт зардал", data: fixedCost.map((f, i) => f + variableCost[i]) },
      { name: "Тогтмол зардал", data: fixedCost },
    ],
    [revenue, fixedCost, variableCost]
  );

  return (
    <div className="-ml-2 min-h-[320px]">
      <ReactApexChart
        type="line"
        series={series}
        options={options}
        height={320}
      />
    </div>
  );
}
