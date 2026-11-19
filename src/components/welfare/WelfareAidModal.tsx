"use client";

import React, { useCallback, useEffect, useState } from "react";
import { History, ImagePlus, X } from "lucide-react";

import ImageViewer from "@/components/common/ImageViewer";
import { Modal } from "@/components/ui/modal";
import {
  listAids,
  recordAid,
  type WelfareAid,
  type WelfareHousehold,
  type WelfareBoard,
} from "@/lib/welfare";
import { dateTimeFormat } from "@/lib/dateFormat";
import {
  MAX_WELFARE_PHOTOS,
  MAX_WELFARE_PHOTO_BYTES,
  uploadWelfarePhoto,
} from "@/lib/storage";

/** Сонгосон боловч хараахан байршуулаагүй зураг */
type PendingPhoto = { file: File; preview: string };

type WelfareAidModalProps = {
  /** null бол цонх хаалттай */
  household: WelfareHousehold | null;
  /** Шинэ бүртгэл нэмэх эрхтэй эсэх — уншихыг бүгдэд нээлттэй */
  canRecord: boolean;
  onClose: () => void;
  /** Бүртгэсний дараа жагсаалтыг шинэчлэхэд */
  onRecorded: () => void;
  board?: WelfareBoard;
};

const money = new Intl.NumberFormat("mn-MN");

const dateTime = dateTimeFormat;

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
  board = "main",
}: WelfareAidModalProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  /** Хадгалахаас өмнө сонгосон зургууд — илгээх үед л байршуулна */
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  /** Томруулж харах зураг */
  const [viewer, setViewer] = useState<string | null>(null);

  const [aids, setAids] = useState<WelfareAid[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const householdId = household?.id ?? null;

  const loadHistory = useCallback(async () => {
    if (!householdId) return;

    setLoading(true);
    try {
      setAids(await listAids(householdId, board));
    } catch (err) {
      console.error("Халамжийн түүх ачаалж чадсангүй:", err);
      setError("Түүхийг ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, [householdId, board]);

  // Цонх нээгдэх бүрд маягтыг цэвэрлээд түүхийг татна
  useEffect(() => {
    setDescription("");
    setAmount(0);
    setNote("");
    setPending([]);
    setError(null);
    setAids([]);
    loadHistory();
  }, [loadHistory]);

  if (!household) return null;

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Ижил файлыг дахин сонгож болохоор утгыг цэвэрлэнэ
    event.target.value = "";
    setError(null);

    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length < files.length) {
      setError("Зөвхөн зураг оруулах боломжтой.");
    }

    if (images.some((file) => file.size > MAX_WELFARE_PHOTO_BYTES)) {
      setError("Зургийн хэмжээ 10MB-аас хэтэрч болохгүй.");
      return;
    }

    const room = MAX_WELFARE_PHOTOS - pending.length;
    if (images.length > room) {
      setError(`Нэг удаагийн халамжид ${MAX_WELFARE_PHOTOS} хүртэл зураг оруулна.`);
    }

    setPending((current) => [
      ...current,
      ...images.slice(0, Math.max(0, room)).map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
  };

  /** Хадгалахаас ӨМНӨ л хасна — бүртгэгдсэн зургийг устгах боломжгүй */
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
        pending.map((photo) => uploadWelfarePhoto(household.id, photo.file))
      );

      await recordAid(household.id, { description, amount, note, photos }, board);
      await loadHistory();
      onRecorded();
      setDescription("");
      setAmount(0);
      setNote("");
      setPending((current) => {
        current.forEach((photo) => URL.revokeObjectURL(photo.preview));
        return [];
      });
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
              <p className={labelClass}>
                Зураг{" "}
                <span className="text-gray-400">
                  (заавал биш, {MAX_WELFARE_PHOTOS} хүртэл)
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

                {pending.length < MAX_WELFARE_PHOTOS && (
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
              <p className="mt-1.5 text-theme-xs text-gray-400">
                Бүртгэсний дараа зургийг устгах, солих боломжгүй.
              </p>
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

                {aid.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {aid.photos.map((photo) => (
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