"use client";

import PointPickerMap, { homeGlyph } from "@/components/map/PointPickerMap";

import type { WelfareHousehold } from "@/lib/welfare";

const money = new Intl.NumberFormat("mn-MN");

const shortDate = new Intl.DateTimeFormat("mn-MN", {
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
});

type WelfareLeafletMapProps = {
  households: WelfareHousehold[];
  /** Байршил сонгох горим идэвхтэй эсэх — зөвхөн админд */
  picking: boolean;
  onPick: (lat: number, lng: number) => void;
  onEdit: (household: WelfareHousehold) => void;
  onDelete: (household: WelfareHousehold) => void;
  /** Халамжийн бүртгэл ба түүхийн цонхыг нээнэ */
  onAid: (household: WelfareHousehold) => void;
  canManage: boolean;
  /** Устгах эрх нь өрх тус бүрээр өөр — түүхтэй нь зөвхөн super */
  canDelete: (household: WelfareHousehold) => boolean;
};

export default function WelfareLeafletMap({
  households,
  picking,
  onPick,
  onEdit,
  onDelete,
  onAid,
  canManage,
  canDelete,
}: WelfareLeafletMapProps) {
  return (
    <PointPickerMap
      points={households}
      picking={picking}
      onPick={onPick}
      color="#0ea5e9"
      glyph={homeGlyph}
      renderPopup={(household) => (
        <div className="min-w-[220px] text-sm">
          <p className="font-semibold text-gray-900">{household.name}</p>

          {!household.active && (
            <p className="mt-0.5 text-xs font-medium text-gray-500">
              Жагсаалтаас түр гарсан
            </p>
          )}

          <div className="mt-1.5 space-y-0.5 text-gray-700">
            {household.phone && (
              <p>
                <span className="font-semibold">Утас:</span>{" "}
                <a href={`tel:${household.phone}`} className="text-accent-700">
                  {household.phone}
                </a>
              </p>
            )}
            <p>
              <span className="font-semibold">Гэр бүлийн тоо:</span>{" "}
              {household.familySize || "—"}
            </p>
          </div>

          {household.note && (
            <p className="mt-1 text-xs text-gray-500">{household.note}</p>
          )}

          {/* Сүүлийн халамж — зураг дээрээс шууд харагдах ёстой мэдээлэл */}
          <div className="mt-2 space-y-0.5 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
            {household.lastAid ? (
              <>
                <p>
                  <span className="font-semibold">Сүүлд үзүүлсэн:</span>{" "}
                  {shortDate.format(household.lastAid.providedAt)} ·{" "}
                  {household.lastAid.description}
                  {household.lastAid.amount > 0 &&
                    ` · ${money.format(household.lastAid.amount)}₮`}
                </p>
                <p>
                  <span className="font-semibold">Нийт:</span>{" "}
                  {household.aidCount} удаа ·{" "}
                  {money.format(household.totalAmount)}₮
                </p>
              </>
            ) : (
              <p>Хараахан халамж үзүүлээгүй байна.</p>
            )}
          </div>

          <p className="mt-2 text-xs text-gray-400">
            {household.lat.toFixed(5)}, {household.lng.toFixed(5)}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onAid(household)}
              className="rounded-lg border border-accent-300 px-2.5 py-1 text-xs font-medium text-accent-700 hover:bg-accent-50"
            >
              {canManage ? "Халамж бүртгэх" : "Халамжийн түүх"}
            </button>

            {canManage && (
              <button
                type="button"
                onClick={() => onEdit(household)}
                className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Засах
              </button>
            )}

            {/* Халамжийн түүхтэй өрхийг зөвхөн super устгана — эрхгүй бол
                товч огт харагдахгүй, шалтгааныг нь тайлбарлана */}
            {canManage &&
              (canDelete(household) ? (
                <button
                  type="button"
                  onClick={() => onDelete(household)}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-error-600 hover:bg-error-50"
                >
                  Устгах
                </button>
              ) : (
                <span className="self-center text-xs text-gray-400">
                  Түүхтэй — устгахад super эрх
                </span>
              ))}
          </div>
        </div>
      )}
    />
  );
}