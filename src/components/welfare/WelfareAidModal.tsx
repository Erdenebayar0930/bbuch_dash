"use client";

import React, { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import {
  listAids,
  recordAid,
  type WelfareAid,
  type WelfareHousehold,
} from "@/lib/welfare";

type WelfareAidModalProps = {
  /** null бол цонх хаалттай */
  household: WelfareHousehold | null;
  /** Шинэ бүртгэл нэмэх эрхтэй эсэх — уншихыг бүгдэд нээлттэй */
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

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

/**
 * Халамж үзүүлсэн бүртгэл — шинийг нэмэх ба өмнөх түүхийг харах.
 *
 * Хуучин бүртгэл дарагдахгүй: тусламж бүр тусдаа мөр болж үлдэнэ.
 */
export default function WelfareAidModal({
  household,
  canRecord,
  onClose,
  onRecorded,
}: WelfareAidModalProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");

  const [aids, setAids] = useState<WelfareAid[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const householdId = household?.id ?? null;

  const loadHistory = useCallback(async () => {
    if (!householdId) return;

    setLoading(true);
    try {
      setAids(await listAids(householdId));
    } catch (err) {
      console.error("Халамжийн түүх ачаалж чадсангүй:", err);
      setError("Түүхийг ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  // Цонх нээгдэх бүрд маягтыг цэвэрлээд түүхийг татна
  useEffect(() => {
    setDescription("");
    setAmount(0);
    setNote("");
    setError(null);
    setAids([]);
    loadHistory();
  }, [loadHistory]);

  if (!household) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await recordAid(household.id, { description, amount, note });
      await loadHistory();
      onRecorded();
      setDescription("");
      setAmount(0);
      setNote("");
    } catch (err) {
      console.error("Халамж бүртгэхэд алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Бүртгэхэд алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={Boolean(household)} onClose={onClose} className="max-w-lg p-0">
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Халамж үзүүлсэн бүртгэл
        </h3>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          {household.name}
          {household.phone ? ` · ${household.phone}` : ""}
          {household.familySize ? ` · ${household.familySize} хүн` : ""}
        </p>

        <p className="mt-3 rounded-lg bg-gray-50 px-3.5 py-2.5 text-theme-sm text-gray-700 dark:bg-white/[0.03] dark:text-gray-300">
          Нийт{" "}
          <span className="font-semibold">{household.aidCount}</span> удаа ·{" "}
          <span className="font-semibold">
            {money.format(household.totalAmount)}₮
          </span>
        </p>

        {canRecord && (
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
            <div>
              <label htmlFor="aid-description" className={labelClass}>
                Юу үзүүлсэн <span className="text-error-500">*</span>
              </label>
              <input
                id="aid-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Жишээ нь: Хүнсний багц"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="aid-amount" className={labelClass}>
                Зарцуулсан дүн, ₮{" "}
                <span className="text-gray-400">(мөнгөн бус бол 0)</span>
              </label>
              <input
                id="aid-amount"
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
              <label htmlFor="aid-note" className={labelClass}>
                Тэмдэглэл <span className="text-gray-400">(заавал биш)</span>
              </label>
              <textarea
                id="aid-note"
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
              {saving ? "Бүртгэж байна..." : "Халамж бүртгэх"}
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
            Халамжийн түүх
          </p>

          {loading && aids.length === 0 && (
            <p className="text-theme-sm text-gray-500">Ачаалж байна...</p>
          )}

          {!loading && aids.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-200 px-4 py-5 text-center text-theme-sm text-gray-400 dark:border-white/10">
              Энэ өрхөд хараахан халамж үзүүлээгүй байна.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {aids.map((aid) => (
              <li
                key={aid.id}
                className="rounded-lg border border-gray-200 p-3 dark:border-white/10"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-theme-sm font-medium text-gray-900 dark:text-white">
                    {aid.description}
                  </span>

                  {aid.amount > 0 && (
                    <span className="text-theme-sm font-semibold text-gray-900 dark:text-white">
                      {money.format(aid.amount)}₮
                    </span>
                  )}

                  <span className="ml-auto text-theme-xs text-gray-400">
                    {dateTime.format(aid.providedAt)}
                  </span>
                </div>

                <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                  {aid.providedByName}
                  {aid.note ? ` · ${aid.note}` : ""}
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