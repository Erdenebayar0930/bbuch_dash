"use client";

import React, { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import {
  createGuardPoint,
  updateGuardPoint,
  type GuardPoint,
  type GuardPointInput,
} from "@/lib/guardPoints";

type GuardPointModalProps = {
  isOpen: boolean;
  /** null бол шинээр нэмнэ */
  point: GuardPoint | null;
  /** Газрын зураг дээрээс сонгосон цэг — шинэ цэгийн эхний координат */
  picked: { lat: number; lng: number } | null;
  onClose: () => void;
  onSaved: () => void;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

const emptyInput: GuardPointInput = {
  name: "",
  address: "",
  lat: 0,
  lng: 0,
  note: "",
  active: true,
};

export default function GuardPointModal({
  isOpen,
  point,
  picked,
  onClose,
  onSaved,
}: GuardPointModalProps) {
  const [form, setForm] = useState<GuardPointInput>(emptyInput);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Цонх нээгдэх бүрд засаж буй мөр эсвэл сонгосон цэгээр дүүргэнэ
  useEffect(() => {
    setForm(
      point
        ? {
            name: point.name,
            address: point.address,
            lat: point.lat,
            lng: point.lng,
            note: point.note,
            active: point.active,
          }
        : {
            ...emptyInput,
            lat: picked?.lat ?? 0,
            lng: picked?.lng ?? 0,
          }
    );
    setError(null);
  }, [point, picked, isOpen]);

  const update = <K extends keyof GuardPointInput>(
    key: K,
    value: GuardPointInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (point) {
        await updateGuardPoint(point.id, form);
      } else {
        await createGuardPoint(form);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error("Байршил хадгалахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md p-0">
      <form onSubmit={handleSubmit} className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {point ? "Харуулын цэг засах" : "Харуулын цэг нэмэх"}
        </h3>

        <div className="mt-5 grid gap-4">
          <div>
            <label htmlFor="point-name" className={labelClass}>
              Нэр <span className="text-error-500">*</span>
            </label>
            <input
              id="point-name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Жишээ нь: Зүүн хаалга"
              className={fieldClass}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="point-address" className={labelClass}>
              Хаяг / чиглүүлэг{" "}
              <span className="text-gray-400">(заавал биш)</span>
            </label>
            <input
              id="point-address"
              value={form.address}
              onChange={(event) => update("address", event.target.value)}
              placeholder="Зогсоолын зүүн буланд"
              className={fieldClass}
            />
          </div>

          {/* Координат — газрын зургаас сонгоно, гараар нарийвчилж болно */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="point-lat" className={labelClass}>
                Өргөрөг
              </label>
              <input
                id="point-lat"
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
              <label htmlFor="point-lng" className={labelClass}>
                Уртраг
              </label>
              <input
                id="point-lng"
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

          <div>
            <label htmlFor="point-note" className={labelClass}>
              Тэмдэглэл <span className="text-gray-400">(заавал биш)</span>
            </label>
            <textarea
              id="point-note"
              value={form.note}
              onChange={(event) => update("note", event.target.value)}
              rows={2}
              className={`${fieldClass} h-auto py-2.5`}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3.5 py-2.5 dark:border-white/10">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => update("active", event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500/30 dark:border-white/20 dark:bg-white/10"
            />
            <span className="text-theme-sm text-gray-700 dark:text-gray-300">
              Идэвхтэй — энэ цэгт одоо харуул гардаг
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