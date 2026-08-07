"use client";

import React, { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { scheduleConfigs, type ScheduleKind } from "@/data/scheduleOptions";
import {
  createShift,
  updateShift,
  type ScheduleShift,
  type ShiftInput,
} from "@/lib/schedule";

import type { AppUser } from "@/lib/users";

type ScheduleShiftModalProps = {
  isOpen: boolean;
  kind: ScheduleKind;
  /** null бол шинээр нэмнэ */
  shift: ScheduleShift | null;
  people: AppUser[];
  /** Шинэ ээлжийн анхны огноо — харагдаж буй сарын эхэн */
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

const fullName = (person: AppUser) =>
  [person.first_name, person.last_name].filter(Boolean).join(" ") ||
  person.email;

export default function ScheduleShiftModal({
  isOpen,
  kind,
  shift,
  people,
  defaultDate,
  onClose,
  onSaved,
}: ScheduleShiftModalProps) {
  const config = scheduleConfigs[kind];

  const [form, setForm] = useState<ShiftInput>({
    date: defaultDate,
    assignedTo: null,
    area: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Цонх нээгдэх бүрд засаж буй мөрийн утгаар дүүргэнэ
  useEffect(() => {
    setForm(
      shift
        ? {
            date: shift.date,
            assignedTo: shift.assignedTo,
            area: shift.area,
            note: shift.note,
          }
        : { date: defaultDate, assignedTo: null, area: "", note: "" }
    );
    setError(null);
  }, [shift, isOpen, defaultDate]);

  const update = <K extends keyof ShiftInput>(key: K, value: ShiftInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (shift) {
        await updateShift(shift.id, form);
      } else {
        await createShift(kind, form);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error("Ээлж хадгалахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md p-0">
      <form onSubmit={handleSubmit} className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {shift ? "Ээлж засах" : `${config.label} — ээлж нэмэх`}
        </h3>

        <div className="mt-5 grid gap-4">
          <div>
            <label htmlFor="shift-date" className={labelClass}>
              Огноо <span className="text-error-500">*</span>
            </label>
            <input
              id="shift-date"
              type="date"
              value={form.date}
              onChange={(event) => update("date", event.target.value)}
              className={fieldClass}
              required
            />
          </div>

          <div>
            <label htmlFor="shift-assignee" className={labelClass}>
              Хариуцагч
            </label>
            <select
              id="shift-assignee"
              value={form.assignedTo ?? ""}
              onChange={(event) =>
                update("assignedTo", event.target.value || null)
              }
              className={fieldClass}
            >
              <option value="">Хуваарилаагүй</option>
              {people.map((person) => (
                <option key={person.uid} value={person.uid}>
                  {fullName(person)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="shift-area" className={labelClass}>
              {config.areaLabel}{" "}
              <span className="text-gray-400">(заавал биш)</span>
            </label>
            <input
              id="shift-area"
              value={form.area}
              onChange={(event) => update("area", event.target.value)}
              placeholder={config.areaPlaceholder}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="shift-note" className={labelClass}>
              Тэмдэглэл <span className="text-gray-400">(заавал биш)</span>
            </label>
            <textarea
              id="shift-note"
              value={form.note}
              onChange={(event) => update("note", event.target.value)}
              rows={3}
              className={`${fieldClass} h-auto py-2.5`}
            />
          </div>
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