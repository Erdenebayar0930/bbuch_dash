"use client";

import React, { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import {
  MAX_GUARD_VISIT_NOTE,
  guardVisitStatusLabels,
  guardVisitStatuses,
  type GuardVisitStatus,
} from "@/data/guardOptions";
import {
  listGuardVisits,
  recordGuardVisit,
  type GuardPoint,
  type GuardVisit,
} from "@/lib/guardPoints";

type GuardPointVisitModalProps = {
  /** null бол цонх хаалттай */
  point: GuardPoint | null;
  /** Шинэ эргэлт бүртгэх эрхтэй эсэх — уншихыг бүгдэд нээлттэй */
  canRecord: boolean;
  onClose: () => void;
  /** Бүртгэсний дараа жагсаалтыг шинэчлэхэд */
  onRecorded: () => void;
};

const dateTime = new Intl.DateTimeFormat("mn-MN", {
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const statusStyles: Record<GuardVisitStatus, string> = {
  ok: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  issue: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
};

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

/**
 * Харуулын цэгийн эргэлт — шинийг бүртгэх ба өмнөх түүхийг харах.
 *
 * Хуучин бүртгэл дарагдахгүй: эргэлт бүр тусдаа мөр болж үлдэнэ.
 */
export default function GuardPointVisitModal({
  point,
  canRecord,
  onClose,
  onRecorded,
}: GuardPointVisitModalProps) {
  const [status, setStatus] = useState<GuardVisitStatus>("ok");
  const [note, setNote] = useState("");

  const [visits, setVisits] = useState<GuardVisit[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pointId = point?.id ?? null;

  const loadHistory = useCallback(async () => {
    if (!pointId) return;

    setLoading(true);
    try {
      setVisits(await listGuardVisits(pointId));
    } catch (err) {
      console.error("Эргэлтийн түүх ачаалж чадсангүй:", err);
      setError("Түүхийг ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, [pointId]);

  // Цонх нээгдэх бүрд маягтыг цэвэрлээд түүхийг татна
  useEffect(() => {
    setStatus("ok");
    setNote("");
    setError(null);
    setVisits([]);
    loadHistory();
  }, [loadHistory]);

  if (!point) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await recordGuardVisit(point.id, { status, note });
      await loadHistory();
      onRecorded();
      setNote("");
    } catch (err) {
      console.error("Эргэлт бүртгэхэд алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Бүртгэхэд алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={Boolean(point)} onClose={onClose} className="max-w-lg p-0">
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Харуулын эргэлт
        </h3>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          {point.name}
          {point.address ? ` · ${point.address}` : ""}
        </p>

        {canRecord && (
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
            <div>
              <label htmlFor="guard-visit-status" className={labelClass}>
                Байдал
              </label>
              <select
                id="guard-visit-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as GuardVisitStatus)
                }
                className={fieldClass}
              >
                {guardVisitStatuses.map((item) => (
                  <option key={item} value={item}>
                    {guardVisitStatusLabels[item]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="guard-visit-note" className={labelClass}>
                Тэмдэглэл <span className="text-gray-400">(заавал биш)</span>
              </label>
              <textarea
                id="guard-visit-note"
                value={note}
                maxLength={MAX_GUARD_VISIT_NOTE}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                className={`${fieldClass} h-auto py-2.5`}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="justify-self-start rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Бүртгэж байна..." : "Эргэлт бүртгэх"}
            </button>
          </form>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}

        {/* Түүх */}
        <div className="mt-6">
          <p className="mb-2 flex items-center gap-2 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            <History className="h-4 w-4" strokeWidth={1.8} />
            Эргэлтийн түүх
          </p>

          {loading && visits.length === 0 && (
            <p className="text-theme-sm text-gray-500">Ачаалж байна...</p>
          )}

          {!loading && visits.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-200 px-4 py-5 text-center text-theme-sm text-gray-400 dark:border-white/10">
              Энэ цэг дээр хараахан эргээгүй байна.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {visits.map((visit) => (
              <li
                key={visit.id}
                className="rounded-lg border border-gray-200 p-3 dark:border-white/10"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-theme-xs font-medium ${statusStyles[visit.status] ?? statusStyles.ok}`}
                  >
                    {guardVisitStatusLabels[visit.status] ?? visit.status}
                  </span>

                  <span className="ml-auto text-theme-xs text-gray-400">
                    {dateTime.format(visit.visitedAt)}
                  </span>
                </div>

                <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                  {visit.visitedByName}
                  {visit.note ? ` · ${visit.note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            Хаах
          </button>
        </div>
      </div>
    </Modal>
  );
}
