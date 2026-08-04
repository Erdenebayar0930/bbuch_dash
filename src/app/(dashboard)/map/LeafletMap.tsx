"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Moon, Sun } from "lucide-react";
import { useMemo, useState } from "react";
import { MapContainer, Marker, Polygon, Popup, TileLayer } from "react-leaflet";

import { khoroos, tonnage } from "@/data/khoroos";

import type { Khoroo } from "@/data/khoroos";
import type { LatLngExpression } from "leaflet";

const center: LatLngExpression = [47.92, 106.92];

/** Хорооны өнгөөр будсан зүү */
const pinIcon = (color: string) =>
  L.divIcon({
    className: "",
    html: `<svg width="26" height="36" viewBox="0 0 26 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 1C6.9 1 2 5.9 2 12c0 8 11 23 11 23s11-15 11-23C24 5.9 19.1 1 13 1z"
        fill="${color}" stroke="#ffffff" stroke-width="2" />
      <circle cx="13" cy="12" r="4.2" fill="#ffffff" />
    </svg>`,
    iconSize: [26, 36],
    iconAnchor: [13, 35],
    popupAnchor: [0, -30],
  });

/** Полигоны төв дэх хорооны нэрийн шошго */
const labelIcon = (khoroo: Khoroo, color: string) =>
  L.divIcon({
    className: "",
    html: `<span style="border-color:${color};color:${color}"
      class="whitespace-nowrap rounded-full border-2 bg-white/90 px-2 py-0.5 text-[11px] font-semibold shadow-sm">
      ${khoroo.name}
    </span>`,
    iconSize: [78, 22],
    iconAnchor: [39, 11],
  });

export default function LeafletMap({
  selectedId = null,
  onSelect,
}: {
  /** Мэдэгдэл илгээх маягттай хуваалцах сонголт */
  selectedId?: number | null;
  onSelect?: (id: number | null) => void;
} = {}) {
  const [isDark, setIsDark] = useState(false);
  const [visible, setVisible] = useState<number[]>(() =>
    khoroos.map((khoroo) => khoroo.id),
  );
  const [hovered, setHovered] = useState<number | null>(null);

  const colorOf = (khoroo: Khoroo) => (isDark ? khoroo.colorDark : khoroo.color);
  const shown = useMemo(
    () => khoroos.filter((khoroo) => visible.includes(khoroo.id)),
    [visible],
  );

  const toggle = (id: number) =>
    setVisible((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );

  return (
    <div>
      {/* Хороо тус бүрийн шүүлтүүр — өнгөний тайлбар мөн болно */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        {khoroos.map((khoroo) => {
          const isOn = visible.includes(khoroo.id);
          return (
            <button
              key={khoroo.id}
              type="button"
              onClick={() => toggle(khoroo.id)}
              onMouseEnter={() => setHovered(khoroo.id)}
              onMouseLeave={() => setHovered(null)}
              aria-pressed={isOn}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                isOn
                  ? "border-gray-300 bg-gray-50 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  : "border-gray-200 bg-transparent text-gray-400 dark:border-gray-800 dark:text-gray-600"
              }`}
            >
              <span
                className="khoroo-swatch h-3 w-3 rounded-sm"
                style={
                  {
                    "--khoroo-color": khoroo.color,
                    "--khoroo-color-dark": khoroo.colorDark,
                    opacity: isOn ? 1 : 0.35,
                  } as React.CSSProperties
                }
              />
              {khoroo.name}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {khoroo.points.length} цэг · {tonnage(khoroo)} т
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setVisible(khoroos.map((khoroo) => khoroo.id))}
          className="ml-auto rounded-full px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
        >
          Бүгдийг харуулах
        </button>
      </div>

      <div className="relative overflow-hidden">
        <button
          type="button"
          onClick={() => setIsDark((value) => !value)}
          className="absolute left-3 top-3 z-[1000] flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm backdrop-blur hover:bg-white dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-100"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {isDark ? "Light mode" : "Dark mode"}
        </button>

        <MapContainer
          center={center}
          zoom={13}
          scrollWheelZoom
          className="h-[480px] w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={
              isDark
                ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            }
          />

          {shown.map((khoroo) => {
            const color = colorOf(khoroo);
            const isActive = hovered === khoroo.id || selectedId === khoroo.id;
            const isSelected = selectedId === khoroo.id;
            return (
              <Polygon
                key={`zone-${khoroo.id}`}
                positions={khoroo.boundary}
                pathOptions={{
                  color,
                  fillColor: color,
                  weight: isActive ? 4 : 2,
                  fillOpacity: isActive ? 0.45 : 0.25,
                  dashArray: isSelected ? "6 4" : undefined,
                }}
                eventHandlers={{
                  mouseover: () => setHovered(khoroo.id),
                  mouseout: () => setHovered(null),
                  click: () => onSelect?.(isSelected ? null : khoroo.id),
                }}
              >
                <Popup>
                  <div className="min-w-[200px] text-sm">
                    <p className="font-semibold" style={{ color }}>
                      {khoroo.name}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      {khoroo.points.length} хогийн цэг · {tonnage(khoroo)} тонн
                    </p>
                    {onSelect && (
                      <p className="mt-1 text-xs text-gray-500">
                        {isSelected
                          ? "Мэдэгдэл илгээхээр сонгогдсон"
                          : "Мэдэгдэл илгээхээр сонгох бол бүс дээр дарна уу"}
                      </p>
                    )}
                  </div>
                </Popup>
              </Polygon>
            );
          })}

          {shown.map((khoroo) => (
            <Marker
              key={`label-${khoroo.id}`}
              position={khoroo.labelAt}
              icon={labelIcon(khoroo, colorOf(khoroo))}
              interactive={false}
            />
          ))}

          {shown.flatMap((khoroo) =>
            khoroo.points.map((point) => (
              <Marker
                key={point.name}
                position={[point.lat, point.lng]}
                icon={pinIcon(colorOf(khoroo))}
              >
                <Popup>
                  <div className="min-w-[220px] text-sm">
                    <p
                      className="font-semibold"
                      style={{ color: colorOf(khoroo) }}
                    >
                      {point.name}
                    </p>
                    <p className="mt-1 text-gray-700">{point.detail}</p>
                    <div className="mt-2 space-y-1 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
                      <p>
                        <span className="font-semibold">Хороо:</span>{" "}
                        {khoroo.name}
                      </p>
                      <p>
                        <span className="font-semibold">Хуваарь:</span>{" "}
                        {point.schedule}
                      </p>
                      <p>
                        <span className="font-semibold">Бүс:</span> {point.zone}
                      </p>
                      <p>
                        <span className="font-semibold">Түргэн хэмжээ:</span>{" "}
                        {point.volume}
                      </p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )),
          )}
        </MapContainer>
      </div>
    </div>
  );
}
