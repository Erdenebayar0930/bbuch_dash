"use client";

import PointPickerMap, { boxGlyph } from "@/components/map/PointPickerMap";
import { visitStatusLabels } from "@/data/donationBoxOptions";

import type { DonationBox } from "@/lib/donationBoxes";

const money = new Intl.NumberFormat("mn-MN");

const shortDate = new Intl.DateTimeFormat("mn-MN", {
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
});

type DonationBoxLeafletMapProps = {
  boxes: DonationBox[];
  /** Байршил сонгох горим идэвхтэй эсэх — зөвхөн админд */
  picking: boolean;
  onPick: (lat: number, lng: number) => void;
  onEdit: (box: DonationBox) => void;
  onDelete: (box: DonationBox) => void;
  /** Эргэлтийн бүртгэл ба түүхийн цонхыг нээнэ */
  onVisit: (box: DonationBox) => void;
  canManage: boolean;
};

export default function DonationBoxLeafletMap({
  boxes,
  picking,
  onPick,
  onEdit,
  onDelete,
  onVisit,
  canManage,
}: DonationBoxLeafletMapProps) {
  return (
    <PointPickerMap
      points={boxes}
      picking={picking}
      onPick={onPick}
      color="#f97316"
      glyph={boxGlyph}
      renderPopup={(box) => (
        <div className="min-w-[210px] text-sm">
          <p className="font-semibold text-gray-900">{box.name}</p>

          {!box.active && (
            <p className="mt-0.5 text-xs font-medium text-gray-500">
              Түр хураагдсан
            </p>
          )}

          {box.address && <p className="mt-1 text-gray-700">{box.address}</p>}

          {box.note && <p className="mt-1 text-xs text-gray-500">{box.note}</p>}

          {/* Сүүлийн эргэлт — зураг дээрээс шууд харагдах ёстой мэдээлэл */}
          <div className="mt-2 space-y-0.5 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
            {box.lastVisit ? (
              <>
                <p>
                  <span className="font-semibold">Сүүлд эргэсэн:</span>{" "}
                  {shortDate.format(box.lastVisit.visitedAt)} ·{" "}
                  {visitStatusLabels[box.lastVisit.status]}
                  {box.lastVisit.status === "collected" &&
                    ` · ${money.format(box.lastVisit.amount)}₮ · ${money.format(box.lastVisit.clothingCount)} ш хувцас`}
                </p>
                <p>
                  <span className="font-semibold">Нийт хураасан:</span>{" "}
                  {money.format(box.totalCollected)}₮ ·{" "}
                  {money.format(box.totalClothing)} ш хувцас
                </p>
              </>
            ) : (
              <p>Хараахан эргээгүй байна.</p>
            )}
          </div>

          <p className="mt-2 text-xs text-gray-400">
            {box.lat.toFixed(5)}, {box.lng.toFixed(5)}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onVisit(box)}
              className="rounded-lg border border-accent-300 px-2.5 py-1 text-xs font-medium text-accent-700 hover:bg-accent-50"
            >
              {canManage ? "Эргэлт бүртгэх" : "Эргэлтийн түүх"}
            </button>

            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(box)}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Засах
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(box)}
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