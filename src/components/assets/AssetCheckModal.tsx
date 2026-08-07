"use client";

import React, { useCallback, useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import {
  checkStatusLabels,
  listAssetChecks,
  recordAssetCheck,
  type Asset,
  type AssetCheck,
  type CheckStatus,
} from "@/lib/assets";

type AssetCheckModalProps = {
  asset: Asset | null;
  /** Админ биш бол зөвхөн түүх харагдана */
  canRecord: boolean;
  onClose: () => void;
  onRecorded: () => void;
};

const statusStyles: Record<CheckStatus, string> = {
  ok: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  damaged:
    "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  short:
    "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  missing: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
};

const dateFormatter = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default function AssetCheckModal({
  asset,
  canRecord,
  onClose,
  onRecorded,
}: AssetCheckModalProps) {
  const [history, setHistory] = useState<AssetCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<CheckStatus>("ok");
  const [found, setFound] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (assetId: string) => {
    setLoading(true);
    try {
      setHistory(await listAssetChecks(assetId));
    } catch (err) {
      console.error("Шалгалтын түүх уншихад алдаа гарлаа:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Цонх нээгдэх бүрд түүхийг татаж, маягтыг бүртгэлийн тоогоор дүүргэнэ
  useEffect(() => {
    if (!asset) return;

    setStatus("ok");
    setFound(asset.quantity);
    setNote("");
    setError(null);
    load(asset.id);
  }, [asset, load]);

  if (!asset) return null;

  // Олдсон тоо бүртгэлийнхээс зөрвөл "дутуу" гэж автоматаар саналболгоно
  const suggestShort = found < asset.quantity && status === "ok";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await recordAssetCheck(asset.id, { status, foundQuantity: found, note });
      await load(asset.id);
      setNote("");
      onRecorded();
    } catch (err) {
      console.error("Шалгалт бүртгэхэд алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90";

  return (
    <Modal isOpen={!!asset} onClose={onClose} className="max-w-lg p-0">
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Бүрэн бүтэн байдлын шалгалт
        </h3>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          {asset.name} — бүртгэлээр {asset.quantity} {asset.unit}
        </p>

        {canRecord && (
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="check-status" className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                  Төлөв
                </label>
                <select
                  id="check-status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as CheckStatus)
                  }
                  className={fieldClass}
                >
                  {(Object.keys(checkStatusLabels) as CheckStatus[]).map((key) => (
                    <option key={key} value={key}>
                      {checkStatusLabels[key]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="check-found" className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                  Олдсон тоо
                </label>
                <input
                  id="check-found"
                  type="number"
                  min={0}
                  value={found}
                  onChange={(event) =>
                    setFound(Math.max(0, Number(event.target.value) || 0))
                  }
                  className={fieldClass}
                />
              </div>
            </div>

            {suggestShort && (
              <p className="rounded-lg bg-warning-50 px-4 py-2.5 text-theme-xs text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
                Олдсон тоо бүртгэлийнхээс {asset.quantity - found} {asset.unit}{" "}
                дутуу байна — төлөвийг &quot;Дутуу&quot; болгох уу?
              </p>
            )}

            <div>
              <label htmlFor="check-note" className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                Тэмдэглэл <span className="text-gray-400">(заавал биш)</span>
              </label>
              <textarea
                id="check-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder="Гэмтлийн байдал, байршил гэх мэт"
                className={`${fieldClass} h-auto py-2.5`}
              />
            </div>

            {error && (
              <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
                {error}
              </p>
            )}

            <div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Бүртгэж байна..." : "Шалгалт бүртгэх"}
              </button>
            </div>
          </form>
        )}

        {/* Түүх */}
        <div className="mt-6 border-t border-gray-100 pt-4 dark:border-white/10">
          <p className="mb-3 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            Түүх
          </p>

          {loading && history.length === 0 && (
            <p className="text-theme-sm text-gray-500">Ачаалж байна...</p>
          )}

          {!loading && history.length === 0 && (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              Одоогоор шалгалт хийгдээгүй байна.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {history.map((check) => (
              <li
                key={check.id}
                className="rounded-lg border border-gray-200 p-3 dark:border-white/10"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-theme-xs font-medium ${statusStyles[check.status]}`}
                  >
                    {checkStatusLabels[check.status]}
                  </span>
                  <span className="text-theme-xs text-gray-600 dark:text-gray-400">
                    {check.foundQuantity} {asset.unit}
                  </span>
                  <span className="ml-auto text-theme-xs text-gray-400">
                    {dateFormatter.format(check.checkedAt)}
                  </span>
                </div>
                {check.note && (
                  <p className="mt-1.5 text-theme-xs text-gray-600 dark:text-gray-400">
                    {check.note}
                  </p>
                )}
                <p className="mt-1 text-theme-xs text-gray-400">
                  {check.checkedByName}
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
