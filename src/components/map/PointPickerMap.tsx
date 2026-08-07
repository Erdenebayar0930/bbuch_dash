"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMemo, type ReactNode } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";

import type { LatLngExpression } from "leaflet";

/** Байршил бүртгээгүй үеийн эхлэл — Улаанбаатар */
const fallbackCenter: LatLngExpression = [47.92, 106.92];

/** Зураг дээр байрлах цэгийн доод шаардлага */
export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  /** false бол зүү бүдэг харагдана */
  active: boolean;
};

/** Зүүний дотор талын дүрс — SVG зам, 26×36 viewBox дотор */
export type PinGlyph = string;

/** Хандивын хайрцаг */
export const boxGlyph: PinGlyph = `
  <rect x="7.5" y="8" width="11" height="8" rx="1.2" fill="#ffffff" />
  <rect x="11" y="6.2" width="4" height="2.4" rx="0.8" fill="#ffffff" />`;

/** Айл өрх */
export const homeGlyph: PinGlyph = `
  <path d="M13 6.4 7.4 11v5.6h3.4v-3.2h4.4v3.2h3.4V11z" fill="#ffffff" />`;

const pinIcon = (color: string, active: boolean, glyph: PinGlyph) =>
  L.divIcon({
    className: "",
    html: `<svg width="28" height="38" viewBox="0 0 26 36" xmlns="http://www.w3.org/2000/svg" opacity="${active ? 1 : 0.45}">
      <path d="M13 1C6.9 1 2 5.9 2 12c0 8 11 23 11 23s11-15 11-23C24 5.9 19.1 1 13 1z"
        fill="${active ? color : "#94a3b8"}" stroke="#ffffff" stroke-width="2" />
      ${glyph}
    </svg>`,
    iconSize: [28, 38],
    iconAnchor: [14, 37],
    popupAnchor: [0, -32],
  });

/** Газрын зураг дээрх даралтыг барих туслах — react-leaflet-д hook хэрэгтэй */
function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (event) => onPick(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

type PointPickerMapProps<T extends MapPoint> = {
  points: T[];
  /** Байршил сонгох горим идэвхтэй эсэх — зөвхөн эрхтэй хэрэглэгчид */
  picking: boolean;
  onPick: (lat: number, lng: number) => void;
  /** Тухайн цэгийн popup доторх агуулга */
  renderPopup: (point: T) => ReactNode;
  /** Зүүний өнгө — идэвхтэй цэгүүдэд */
  color: string;
  glyph: PinGlyph;
};

/**
 * Байршил тэмдэглэх, харах ерөнхий газрын зураг.
 *
 * Хандивын хайрцаг ба халамжийн өрх хоёр ижил зан үйлтэй — зөвхөн popup доторх
 * агуулга, зүүний өнгө ялгаатай. Тиймээс зургийн механик энд нэг дор байна.
 */
export default function PointPickerMap<T extends MapPoint>({
  points,
  picking,
  onPick,
  renderPopup,
  color,
  glyph,
}: PointPickerMapProps<T>) {
  /** Эхний идэвхтэй цэг дээр төвлөрнө — байхгүй бол хотын төв */
  const center = useMemo<LatLngExpression>(() => {
    const first = points.find((point) => point.active) ?? points[0];
    return first ? [first.lat, first.lng] : fallbackCenter;
  }, [points]);

  return (
    <MapContainer
      center={center}
      zoom={points.length > 0 ? 15 : 12}
      scrollWheelZoom
      className={`h-[420px] w-full ${picking ? "cursor-crosshair" : ""}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {picking && <ClickCatcher onPick={onPick} />}

      {points.map((point) => (
        <Marker
          key={point.id}
          position={[point.lat, point.lng]}
          icon={pinIcon(color, point.active, glyph)}
        >
          <Popup>{renderPopup(point)}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}