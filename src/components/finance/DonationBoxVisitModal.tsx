"use client";

import React, { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import {
  visitStatusLabels,
  visitStatuses,
  type VisitStatus,
} from "@/data/donationBoxOptions";
import {
  listBoxVisits,
  recordBoxVisit,
  type BoxVisit,
  type DonationBox,
} from "@/lib/donationBoxes";

type DonationBoxVisitModalProps = {
  /** null бол цонх хаалттай */
  box: DonationBox | null;
  /** Шинэ эргэлт бүртгэх эрхтэй эсэх — уншихыг бүгдэд нээлттэй */
  canRecord: boolean;
  onClose: () => void;
  /** Бүртгэсний дараа жагсаалтыг шинэчлэхэд */
  onRecorded: () => void;
};

const money = new Intl.NumberFormat("mn-MN");

const dateTime = new Intl.DateTimeFormat("mn-MN", {
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const statusStyles: Record<VisitStatus, string> = {
  collected:
    "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  empty: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  issue: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
};

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

/**
 * Хайрцгийн эргэлт — шинийг бүртгэх ба өмнөх түүхийг харах.
 *
 * Хуучин бүртгэл дарагдахгүй: эргэлт бүр тусдаа мөр болж үлдэнэ.
 */
export default function DonationBoxVisitModal({
  box,
  canRecord,
  onClose,
  onRecorded,
}: DonationBoxVisitModalProps) {
  const [status, setStatus] = useState<VisitStatus>("collected");
  const [amount, setAmount] = useState(0);
  const [clothingCount, setClothingCount] = useState(0);
  const [note, setNote] = useState("");

  const [visits, setVisits] = useState<BoxVisit[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const boxId = box?.id ?? null;

  const loadHistory = useCallback(async () => {
    if (!boxId) return;

    setLoading(true);
    try {
      setVisits(await listBoxVisits(boxId));
    } catch (err) {
      console.error("Эргэлтийн түүх ачаалж чадсангүй:", err);
      setError("Түүхийг ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, [boxId]);

  // Цонх нээгдэх бүрд маягтыг цэвэрлээд түүхийг татна
  useEffect(() => {
    setStatus("collected");
    setAmount(0);
    setClothingCount(0);
    setNote("");
    setError(null);
    setVisits([]);
    loadHistory();
  }, [loadHistory]);

  if (!box) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Хураагаагүй эргэлтэд хураалт байх учиргүй — сервер ч үүнийг шаарддаг
      const collected = status === "collected";

      await recordBoxVisit(box.id, {
        status,
        amount: collected ? amount : 0,
        clothingCount: collected ? clothingCount : 0,
        note,
      });
      await loadHistory();
      onRecorded();
      setAmount(0);
      setClothingCount(0);
      setNote("");
    } catch (err) {
      console.error("Эргэлт бүртгэхэд алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Бүртгэхэд алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={Boolean(box)} onClose={onClose} className="max-w-lg p-0">
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Хайрцгийн эргэлт
        </h3>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          {box.name}
          {box.address ? ` · ${box.address}` : ""}
        </p>

        <p className="mt-3 rounded-lg bg-gray-50 px-3.5 py-2.5 text-theme-sm text-gray-700 dark:bg-white/[0.03] dark:text-gray-300">
          Нийт хураасан:{" "}
          <span className="font-semibold">
            {money.format(box.totalCollected)}₮
          </span>
          {" · "}
          <span className="font-semibold">
            {money.format(box.totalClothing)}
          </span>{" "}
          ширхэг хувцас
        </p>

        {canRecord && (
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
            <div>
              <label htmlFor="visit-status" className={labelClass}>
                Байдал
              </label>
              <select
                id="visit-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as VisitStatus)
                }
                className={fieldClass}
              >
                {visitStatuses.map((item) => (
                  <option key={item} value={item}>
                    {visitStatusLabels[item]}
                  </option>
                ))}
              </select>
            </div>

            {/* Хураалт зөвхөн "Хураасан" үед утгатай — нэг эргэлтээр мөнгө ба
                хувцас хоёуланг нь хураасан байж болно */}
            {status === "collected" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="visit-amount" className={labelClass}>
                    Хураасан мөнгө, ₮
                  </label>
                  <input
                    id="visit-amount"
                    type="number"
                    min={0}
                    value={amount}
                    onChange={(event) =>
                      setAmount(Math.max(0, Number(event.target.value) || 0))
                    }
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label htmlFor="visit-clothing" className={labelClass}>
                    Хувцас, ширхэг
                  </label>
                  <input
                    id="visit-clothing"
                    type="number"
                    min={0}
                    value={clothingCount}
                    onChange={(event) =>
                      setClothingCount(
                        Math.max(0, Number(event.target.value) || 0)
                      )
                    }
                    className={fieldClass}
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="visit-note" className={labelClass}>
                Тэмдэглэл <span className="text-gray-400">(заавал биш)</span>
              </label>
              <textarea
                id="visit-note"
                value={note}
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
              Энэ хайрцаг дээр хараахан эргээгүй байна.
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
                    className={`rounded-full px-2.5 py-0.5 text-theme-xs font-medium ${statusStyles[visit.status]}`}
                  >
                    {visitStatusLabels[visit.status]}
                  </span>

                  {visit.status === "collected" && (
                    <>
                      {visit.amount > 0 && (
                        <span className="text-theme-sm font-semibold text-gray-900 dark:text-white">
                          {money.format(visit.amount)}₮
                        </span>
                      )}
                      {visit.clothingCount > 0 && (
                        <span className="text-theme-sm font-semibold text-gray-900 dark:text-white">
                          {money.format(visit.clothingCount)} ш хувцас
                        </span>
                      )}
                    </>
                  )}

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