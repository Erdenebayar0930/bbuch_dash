"use client";

import React, { useEffect, useState } from "react";
import { Crosshair, Loader2 } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { getCurrentCoords } from "@/lib/geolocation";
import {
  createHousehold,
  updateHousehold,
  type HouseholdInput,
  type WelfareHousehold,
} from "@/lib/welfare";

type WelfareHouseholdModalProps = {
  isOpen: boolean;
  /** null бол шинээр нэмнэ */
  household: WelfareHousehold | null;
  /** Газрын зураг дээрээс сонгосон цэг — шинэ өрхийн эхний координат */
  picked: { lat: number; lng: number } | null;
  onClose: () => void;
  onSaved: () => void;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

const emptyInput: HouseholdInput = {
  name: "",
  phone: "",
  familySize: 0,
  note: "",
  lat: 0,
  lng: 0,
  active: true,
};

export default function WelfareHouseholdModal({
  isOpen,
  household,
  picked,
  onClose,
  onSaved,
}: WelfareHouseholdModalProps) {
  const [form, setForm] = useState<HouseholdInput>(emptyInput);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  /** Хамгийн сүүлд тогтоосон нарийвчлал, метрээр */
  const [accuracy, setAccuracy] = useState<number | null>(null);

  // Цонх нээгдэх бүрд засаж буй мөр эсвэл сонгосон цэгээр дүүргэнэ
  useEffect(() => {
    setForm(
      household
        ? {
            name: household.name,
            phone: household.phone,
            familySize: household.familySize,
            note: household.note,
            lat: household.lat,
            lng: household.lng,
            active: household.active,
          }
        : { ...emptyInput, lat: picked?.lat ?? 0, lng: picked?.lng ?? 0 }
    );
    setError(null);
    setAccuracy(null);
  }, [household, picked, isOpen]);

  /** Координатыг одоогийн байршлаар солино — засах үед ч ашиглагдана */
  const handleUseMyLocation = async () => {
    setLocating(true);
    setError(null);

    try {
      const coords = await getCurrentCoords();
      setForm((prev) => ({ ...prev, lat: coords.lat, lng: coords.lng }));
      setAccuracy(coords.accuracy);
    } catch (err) {
      console.error("Байршил тогтооход алдаа гарлаа:", err);
      setError(
        err instanceof Error ? err.message : "Байршлыг тогтоож чадсангүй."
      );
    } finally {
      setLocating(false);
    }
  };

  const update = <K extends keyof HouseholdInput>(
    key: K,
    value: HouseholdInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (household) {
        await updateHousehold(household.id, form);
      } else {
        await createHousehold(form);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error("Өрх хадгалахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md p-0">
      <form onSubmit={handleSubmit} className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {household ? "Өрхийн мэдээлэл засах" : "Халамжийн өрх нэмэх"}
        </h3>

        <div className="mt-5 grid gap-4">
          <div>
            <label htmlFor="household-name" className={labelClass}>
              Нэр <span className="text-error-500">*</span>
            </label>
            <input
              id="household-name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Өрхийн тэргүүний нэр"
              className={fieldClass}
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="household-phone" className={labelClass}>
                Утас
              </label>
              <input
                id="household-phone"
                type="tel"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="99001122"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="household-size" className={labelClass}>
                Гэр бүлийн тоо
              </label>
              <input
                id="household-size"
                type="number"
                min={0}
                value={form.familySize}
                onChange={(event) =>
                  update(
                    "familySize",
                    Math.max(0, Number(event.target.value) || 0)
                  )
                }
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="household-note" className={labelClass}>
              Тайлбар <span className="text-gray-400">(нөхцөл байдал)</span>
            </label>
            <textarea
              id="household-note"
              value={form.note}
              onChange={(event) => update("note", event.target.value)}
              rows={3}
              placeholder="Гэр бүлийн нөхцөл байдал, онцгой анхаарах зүйл"
              className={`${fieldClass} h-auto py-2.5`}
            />
          </div>

          {/* Координат — газрын зургаас сонгоно, GPS-ээр авна, эсвэл гараар */}
          <div>
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locating}
              className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
            >
              {locating ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
              ) : (
                <Crosshair className="h-4 w-4" strokeWidth={1.8} />
              )}
              {locating ? "Тогтоож байна..." : "Одоогийн байршлыг ашиглах"}
            </button>

            {/* Нарийвчлал нь координат хэр найдвартайг шууд хэлнэ */}
            {accuracy !== null && (
              <p className="mt-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
                Нарийвчлал ≈ {Math.round(accuracy)} м
                {accuracy > 100 && " — задгай газар дахин оролдвол сайжирна"}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="household-lat" className={labelClass}>
                Өргөрөг
              </label>
              <input
                id="household-lat"
                type="number"
                step="any"
                value={form.lat}
                onChange={(event) =>
                  update("lat", Number(event.target.value) || 0)
                }
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="household-lng" className={labelClass}>
                Уртраг
              </label>
              <input
                id="household-lng"
                type="number"
                step="any"
                value={form.lng}
                onChange={(event) =>
                  update("lng", Number(event.target.value) || 0)
                }
                className={fieldClass}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3.5 py-2.5 dark:border-white/10">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => update("active", event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500/30 dark:border-white/20 dark:bg-white/10"
            />
            <span className="text-theme-sm text-gray-700 dark:text-gray-300">
              Идэвхтэй — халамжийн жагсаалтад байгаа
            </span>
          </label>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            Буцах
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Хадгалж байна..." : "Хадгалах"}
          </button>
        </div>
      </form>
    </Modal>
  );
}