"use client";

import { MapPin, Trash2 } from "lucide-react";
import { useState } from "react";

import LeafletMap from "./LeafletMap";
import AimagGuard from "@/components/AimagGuard";
import { allWastePoints, khoroos, tonnage } from "@/data/khoroos";

export default function MapPage() {
  const totalTonnage = khoroos.reduce((sum, khoroo) => sum + tonnage(khoroo), 0);
  /** Газрын зураг ба мэдэгдлийн маягтын хуваалцсан сонголт */
  const [selectedKhorooId, setSelectedKhorooId] = useState<number | null>(null);

  return (
    <AimagGuard aimag="guard">
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-emerald-600">
                Хогийн цэгийн удирдлага
              </p>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Монгол • Сонгинохайрхан • OpenStreetMap + Leaflet
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                <Trash2 className="h-4 w-4" />
                {allWastePoints.length} хогийн цэг
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {khoroos.length} хороо · {totalTonnage} тонн
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <LeafletMap
              selectedId={selectedKhorooId}
              onSelect={setSelectedKhorooId}
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Хороо тус бүрийн байршил
              </h2>
            </div>
            <div className="space-y-5">
              {khoroos.map((khoroo) => (
                <div key={khoroo.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="khoroo-swatch h-3 w-3 rounded-sm"
                      style={
                        {
                          "--khoroo-color": khoroo.color,
                          "--khoroo-color-dark": khoroo.colorDark,
                        } as React.CSSProperties
                      }
                    />
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {khoroo.name}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {khoroo.points.length} цэг · {tonnage(khoroo)} тонн
                    </span>
                  </div>
                  <div className="space-y-3 pl-5">
                    {khoroo.points.map((point) => (
                      <div
                        key={point.name}
                        className="khoroo-swatch-border rounded-xl border border-l-4 border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50"
                        style={
                          {
                            "--khoroo-color": khoroo.color,
                            "--khoroo-color-dark": khoroo.colorDark,
                          } as React.CSSProperties
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {point.name}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {point.detail}
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                              {point.schedule} · {point.zone}
                            </p>
                          </div>
                          <span className="whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                            {point.lat.toFixed(3)}, {point.lng.toFixed(3)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Дүгнэлт
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
              Энэ газрын зураг нь Сонгинохайрхан дүүргийн хогийн цэгүүдийг хороо
              бүрээр өнгөөр ялган харуулж, цуглуулах болон дахин боловсруулах үйл
              ажиллагааг хялбархан удирдахад тусална.
            </p>
            <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              Сүүлийн 7 хоногийн гүйцэтгэл: 82% цуглуулалт амжилттай
            </div>
            <p className="mt-4 text-xs leading-5 text-gray-500 dark:text-gray-500">
              Тайлбар: хорооны хил нь ойролцоо зураглал бөгөөд албан ёсны
              кадастрын хилийг орлохгүй.
            </p>
          </div>
        </div>
      </div>
    </AimagGuard>
  );
}
