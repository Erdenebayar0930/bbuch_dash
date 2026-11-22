"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import { Archive, Boxes } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { writeOffAsset, type Asset } from "@/lib/assets";

type WriteOffModalProps = {
  /** null бол хаалттай */
  asset: Asset | null;
  onClose: () => void;
  onDone: () => void;
};

/** Шалтгааны хамгийн бага урт — сервертэй ижил (@see api/assets/[id] PATCH) */
const MIN_REASON = 3;
const MAX_REASON = 500;

/**
 * Актлах цонх — эд хөрөнгийг устгахгүй, актална. Шалтгааныг заавал бичнэ;
 * шалтгаан нь ширхэгийн түүхэнд «Актласан шалтгаан»-аар үлдэнэ.
 */
export default function WriteOffModal({ asset, onClose, onDone }: WriteOffModalProps) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setReason("");
    setError("");
  }, [asset]);

  const tooShort = reason.trim().length < MIN_REASON;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!asset || tooShort) return;
    setSaving(true);
    setError("");
    try {
      await writeOffAsset(asset.id, reason.trim());
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Актлахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={!!asset} onClose={onClose} className="max-w-md p-0">
      {asset && (
        <form onSubmit={handleSubmit} className="p-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <Archive className="h-5 w-5 text-warning-600 dark:text-warning-400" strokeWidth={1.8} />
            Эд хөрөнгө актлах
          </h3>

          <div className="mt-4 flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-white/10">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-white/5">
              {asset.images.length > 0 ? (
                <Image src={asset.images[0].url} alt="" width={48} height={48} className="h-full w-full object-cover" />
              ) : (
                <Boxes className="h-5 w-5 text-gray-400" strokeWidth={1.8} />
              )}
            </div>
            <div className="min-w-0">
              {asset.code && (
                <p className="font-mono text-theme-sm font-semibold text-gray-900 dark:text-white">{asset.code}</p>
              )}
              <p className="truncate text-theme-sm text-gray-700 dark:text-gray-300">{asset.name}</p>
              <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                {[asset.warehouseName, asset.categoryName].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          </div>

          <label htmlFor="write-off-reason" className="mt-4 mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            Актлах шалтгаан <span className="text-error-500">*</span>
          </label>
          <textarea
            id="write-off-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={MAX_REASON}
            autoFocus
            placeholder="Жишээ нь: Хагарсан, засварлах боломжгүй"
            className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
          />
          <p className="mt-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
            Акталсан хөрөнгө «Акталсан хөрөнгийн бүртгэл»-д шилжинэ. Устгагдахгүй; шалтгаан нь түүхэнд хадгалагдана.
          </p>

          {error && (
            <p className="mt-3 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
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
              disabled={saving || tooShort}
              className="rounded-lg bg-warning-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-warning-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Актлаж байна..." : "Актлах"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
