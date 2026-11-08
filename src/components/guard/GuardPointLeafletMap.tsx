"use client";

import PointPickerMap, { shieldGlyph } from "@/components/map/PointPickerMap";
import { guardVisitStatusLabels } from "@/data/guardOptions";

import type { GuardPoint } from "@/lib/guardPoints";

const shortDate = new Intl.DateTimeFormat("mn-MN", {
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
});

type GuardPointLeafletMapProps = {
  points: GuardPoint[];
  /** Байршил сонгох горим идэвхтэй эсэх — зөвхөн админд */
  picking: boolean;
  onPick: (lat: number, lng: number) => void;
  onEdit: (point: GuardPoint) => void;
  onDelete: (point: GuardPoint) => void;
  /** Эргэлтийн бүртгэл ба түүхийн цонхыг нээнэ */
  onVisit: (point: GuardPoint) => void;
  canManage: boolean;
};

export default function GuardPointLeafletMap({
  points,
  picking,
  onPick,
  onEdit,
  onDelete,
  onVisit,
  canManage,
}: GuardPointLeafletMapProps) {
  return (
    <PointPickerMap
      points={points}
      picking={picking}
      onPick={onPick}
      color="#2563eb"
      glyph={shieldGlyph}
      renderPopup={(point) => (
        <div className="min-w-[210px] text-sm">
          <p className="font-semibold text-gray-900">{point.name}</p>

          {!point.active && (
            <p className="mt-0.5 text-xs font-medium text-gray-500">
              Түр идэвхгүй
            </p>
          )}

          {point.address && (
            <p className="mt-1 text-gray-700">{point.address}</p>
          )}

          {point.note && (
            <p className="mt-1 text-xs text-gray-500">{point.note}</p>
          )}

          <div className="mt-2 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
            {point.lastVisit ? (
              <p>
                <span className="font-semibold">Сүүлд эргэсэн:</span>{" "}
                {shortDate.format(point.lastVisit.visitedAt)} ·{" "}
                {guardVisitStatusLabels[point.lastVisit.status]}
              </p>
            ) : (
              <p>Хараахан эргээгүй байна.</p>
            )}
          </div>

          <p className="mt-2 text-xs text-gray-400">
            {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onVisit(point)}
              className="rounded-lg border border-accent-300 px-2.5 py-1 text-xs font-medium text-accent-700 hover:bg-accent-50"
            >
              {canManage ? "Эргэлт бүртгэх" : "Эргэлтийн түүх"}
            </button>

            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(point)}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Засах
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(point)}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-error-600 hover:bg-error-50"
                >
                  Устгах
                </button>
              </>
            )}
          </div>
        </div>
      )}
    />
  );
}
