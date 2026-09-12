"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useState } from "react";
import { Boxes } from "lucide-react";

import ImageViewer from "@/components/common/ImageViewer";
import { Modal } from "@/components/ui/modal";
import {
  checkStatusLabels,
  listAssetChecks,
  type Asset,
  type AssetCheck,
  type CheckStatus,
} from "@/lib/assets";

type AssetViewModalProps = {
  /** null бол цонх хаалттай */
  asset: Asset | null;
  onClose: () => void;
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
});

/** Түүхэнд цаг минут нь ялгах чухал үүрэгтэй — нэг өдөр олон шалгалт байж болно */
const dateTimeFormatter = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-gray-100 py-2.5 last:border-0 dark:border-white/5">
      <span className="w-32 shrink-0 text-theme-sm text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-theme-sm text-gray-800 dark:text-white/90">
        {value}
      </span>
    </div>
  );
}

/**
 * Эд хөрөнгийн мэдээллийг зөвхөн харах цонх — засварлах талбаргүй.
 *
 * Жагсаалтын зураг эсвэл "харах" товчоор нээгддэг тул админ бус хэрэглэгч ч
 * бүртгэлийг бүрэн эхээр нь, зургийг нь томруулж үзэх боломжтой.
 */
export default function AssetViewModal({ asset, onClose }: AssetViewModalProps) {
  const [viewer, setViewer] = useState<string | null>(null);
  const [history, setHistory] = useState<AssetCheck[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (assetId: string) => {
    setLoading(true);
    setHistory([]);

    try {
      setHistory(await listAssetChecks(assetId));
    } catch (err) {
      console.error("Шалгалтын түүх уншихад алдаа гарлаа:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Цонх нээгдэх буюу өөр бүртгэл рүү шилжих бүрд түүхийг дахин татна
  useEffect(() => {
    if (!asset) return;
    load(asset.id);
  }, [asset, load]);

  if (!asset) return null;

  // Дараагийн удаа нээхэд өмнөх томруулсан зураг үлдэхээс сэргийлнэ
  const handleClose = () => {
    setViewer(null);
    onClose();
  };

  return (
    <Modal isOpen={!!asset} onClose={handleClose} className="max-w-lg p-0">
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {asset.name}
        </h3>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Эд хөрөнгийн мэдээлэл
        </p>

        {/* Зургууд — дарвал бүтнээр нь томоор нээнэ */}
        <div className="mt-5 flex flex-wrap gap-2">
          {asset.images.length === 0 && (
            <div className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-200 text-gray-400 dark:border-white/10 dark:text-gray-500">
              <Boxes className="h-5 w-5" strokeWidth={1.6} />
              <span className="text-[10px]">Зураггүй</span>
            </div>
          )}

          {asset.images.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setViewer(image.url)}
              aria-label="Зургийг томоор харах"
              className="h-20 w-20 cursor-zoom-in overflow-hidden rounded-lg border border-gray-200 dark:border-white/10"
            >
              <Image
                src={image.url}
                alt=""
                width={80}
                height={80}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>

        <div className="mt-5">
          <Row label="Төрөл" value={asset.categoryName ?? "—"} />
          <Row label="Агуулах" value={asset.warehouseName ?? "—"} />
          <Row
            label="Тоо хэмжээ"
            value={`${asset.quantity} ${asset.unit}`.trim()}
          />
          <Row label="Код / сериал" value={asset.code || "—"} />
          <Row
            label="Бүрэн бүтэн байдал"
            value={
              asset.lastCheck ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-theme-xs font-medium ${statusStyles[asset.lastCheck.status]}`}
                  >
                    {checkStatusLabels[asset.lastCheck.status]}
                  </span>
                  <span className="text-theme-xs text-gray-400">
                    {dateFormatter.format(asset.lastCheck.checkedAt)} · олдсон{" "}
                    {asset.lastCheck.foundQuantity}
                  </span>
                </span>
              ) : (
                "Шалгаагүй"
              )
            }
          />
          <Row label="Бүртгэсэн" value={dateFormatter.format(asset.createdAt)} />
          <Row
            label="Тэмдэглэл"
            value={
              asset.note ? (
                <span className="whitespace-pre-wrap">{asset.note}</span>
              ) : (
                "—"
              )
            }
          />
        </div>

        {/* Бүрэн бүтэн байдлын шалгалтын түүх — зөвхөн уншина */}
        <div className="mt-6 border-t border-gray-100 pt-4 dark:border-white/10">
          <p className="mb-3 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            Шалгалтын түүх
          </p>

          {loading && (
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
                    олдсон {check.foundQuantity} {asset.unit}
                  </span>
                  <span className="ml-auto text-theme-xs text-gray-400">
                    {dateTimeFormatter.format(check.checkedAt)}
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
            onClick={handleClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            Хаах
          </button>
        </div>
      </div>

      <ImageViewer src={viewer} onClose={() => setViewer(null)} />
    </Modal>
  );
}
