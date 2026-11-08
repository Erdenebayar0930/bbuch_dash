"use client";

import React, { useCallback, useEffect, useState } from "react";
import { History, ImagePlus, X } from "lucide-react";

import ImageViewer from "@/components/common/ImageViewer";
import { Modal } from "@/components/ui/modal";
import {
  MAX_VISIT_PHOTOS,
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
import { MAX_VISIT_PHOTO_BYTES, uploadVisitPhoto } from "@/lib/storage";

/** Сонгосон боловч хараахан байршуулаагүй зураг */
type PendingPhoto = { file: File; preview: string };

type DonationBoxVisitModalProps = {
  /** null бол цонх хаалттай */
  box: DonationBox | null;
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
  const [note, setNote] = useState("");
  /** Хадгалахаас өмнө сонгосон зургууд — илгээх үед л байршуулна */
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  /** Томруулж харах зураг */
  const [viewer, setViewer] = useState<string | null>(null);

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
    setNote("");
    setPending([]);
    setError(null);
    setVisits([]);
    loadHistory();
  }, [loadHistory]);

  if (!box) return null;

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Ижил файлыг дахин сонгож болохоор утгыг цэвэрлэнэ
    event.target.value = "";

    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length < files.length) {
      setError("Зөвхөн зураг оруулах боломжтой.");
    }

    const tooBig = images.find((file) => file.size > MAX_VISIT_PHOTO_BYTES);
    if (tooBig) {
      setError("Зургийн хэмжээ 10MB-аас хэтэрч болохгүй.");
      return;
    }

    const room = MAX_VISIT_PHOTOS - pending.length;
    if (images.length > room) {
      setError(`Нэг эргэлтэд ${MAX_VISIT_PHOTOS} хүртэл зураг оруулна.`);
    }

    setPending((current) => [
      ...current,
      ...images.slice(0, Math.max(0, room)).map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
  };

  const removePending = (index: number) => {
    setPending((current) => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const photos = await Promise.all(
        pending.map((photo) => uploadVisitPhoto(box.id, photo.file))
      );

      await recordBoxVisit(box.id, { status, note, photos });
      await loadHistory();
      onRecorded();
      setNote("");
      setPending((current) => {
        current.forEach((photo) => URL.revokeObjectURL(photo.preview));
        return [];
      });
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

            <div>
              <p className={labelClass}>
                Зураг{" "}
                <span className="text-gray-400">
                  (заавал биш, {MAX_VISIT_PHOTOS} хүртэл)
                </span>
              </p>

              <div className="flex flex-wrap gap-2">
                {pending.map((photo, index) => (
                  <div
                    key={photo.preview}
                    className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200 dark:border-white/10"
                  >
                    {/* blob: хаяг тул next/image биш */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.preview}
                      alt=""
                      className="h-full w-full cursor-zoom-in object-cover"
                      onClick={() => setViewer(photo.preview)}
                    />
                    <button
                      type="button"
                      onClick={() => removePending(index)}
                      aria-label="Зургийг хасах"
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {pending.length < MAX_VISIT_PHOTOS && (
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-theme-xs text-gray-500 transition-colors hover:border-accent-400 hover:text-accent-600 dark:border-white/15 dark:text-gray-400">
                    <ImagePlus className="h-5 w-5" strokeWidth={1.8} />
                    Нэмэх
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePick}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>
            </div>

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

                  <span className="ml-auto text-theme-xs text-gray-400">
                    {dateTime.format(visit.visitedAt)}
                  </span>
                </div>

                <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                  {visit.visitedByName}
                  {visit.note ? ` · ${visit.note}` : ""}
                </p>

                {visit.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {visit.photos.map((photo) => (
                      <button
                        key={photo.path}
                        type="button"
                        onClick={() => setViewer(photo.url)}
                        className="h-14 w-14 overflow-hidden rounded-md border border-gray-200 dark:border-white/10"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
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

      <ImageViewer src={viewer} onClose={() => setViewer(null)} />
    </Modal>
  );
}