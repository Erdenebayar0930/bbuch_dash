"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { aimags } from "@/data/profileOptions";
import { setUserChurchInfo, type AppUser } from "@/lib/users";

/** Серверийн шалгалттай ижил хязгаар */
const MAX_CALLINGS = 5;

type ChurchInfoModalProps = {
  user: AppUser | null;
  onClose: () => void;
  /** Амжилттай хадгалсны дараа локал жагсаалтыг шинэчлэхэд */
  onSaved: (uid: string, patch: { aimags: string[]; callings: string[] }) => void;
};

/**
 * Аймаг ба дуудлага оноох цонх — зөвхөн админ.
 *
 * Хүснэгтийн нүдэнд багтахгүй тул тусдаа цонхонд гаргав: аймаг олон сонголттой,
 * дуудлага 5 хүртэл мөртэй.
 */
export default function ChurchInfoModal({
  user,
  onClose,
  onSaved,
}: ChurchInfoModalProps) {
  const [selectedAimags, setSelectedAimags] = useState<string[]>([]);
  const [callings, setCallings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Цонх нээгдэх бүрд тухайн хэрэглэгчийн утгаар дүүргэнэ
  useEffect(() => {
    setSelectedAimags(user?.aimags ?? []);
    setCallings(user?.callings ?? []);
    setError(null);
  }, [user]);

  if (!user) return null;

  const toggleAimag = (value: string, checked: boolean) => {
    setSelectedAimags((prev) =>
      checked ? [...prev, value] : prev.filter((item) => item !== value)
    );
  };

  const updateCalling = (index: number, value: string) => {
    setCallings((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const cleaned = callings.map((item) => item.trim()).filter(Boolean);

    try {
      await setUserChurchInfo(user.uid, {
        aimags: selectedAimags,
        callings: cleaned,
      });
      onSaved(user.uid, { aimags: selectedAimags, callings: cleaned });
      onClose();
    } catch (err) {
      console.error("Чуулганы мэдээлэл хадгалахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;

  return (
    <Modal isOpen={!!user} onClose={onClose} className="max-w-lg p-0">
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Чуулганы харьяалал
        </h3>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          {fullName}
        </p>

        {/* Аймаг — олон сонголт */}
        <div className="mt-5">
          <p className="mb-2 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            Аймаг
          </p>
          <div className="flex flex-col gap-2">
            {aimags.map((aimag) => {
              const checked = selectedAimags.includes(aimag.value);

              return (
                <label
                  key={aimag.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors ${
                    checked
                      ? "border-accent-400 bg-accent-50/60 dark:border-accent-500/50 dark:bg-accent-500/10"
                      : "border-gray-200 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      toggleAimag(aimag.value, event.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500/30 dark:border-white/20 dark:bg-white/10"
                  />
                  <span className="text-theme-sm text-gray-700 dark:text-gray-300">
                    {aimag.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Дуудлага — 5 хүртэл */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
              Дуудлага
            </p>
            <span className="text-theme-xs text-gray-400">
              {callings.length}/{MAX_CALLINGS}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {callings.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-200 px-4 py-4 text-center text-theme-sm text-gray-400 dark:border-white/10">
                Дуудлага оноогоогүй байна.
              </p>
            )}

            {callings.map((calling, index) => (
              <div key={index} className="flex gap-2">
                <input
                  value={calling}
                  onChange={(event) => updateCalling(index, event.target.value)}
                  placeholder="Орон байр дуудлага"
                  maxLength={100}
                  className="h-11 flex-1 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
                />
                <button
                  type="button"
                  onClick={() =>
                    setCallings((prev) => prev.filter((_, i) => i !== index))
                  }
                  aria-label={`${index + 1}-р дуудлагыг хасах`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-error-500 transition-colors hover:bg-error-50 dark:border-white/10 dark:hover:bg-error-500/10"
                >
                  <Trash2 className="h-4.5 w-4.5" strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>

          {callings.length < MAX_CALLINGS && (
            <button
              type="button"
              onClick={() => setCallings((prev) => [...prev, ""])}
              className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Дуудлага нэмэх
            </button>
          )}
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
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Хадгалж байна..." : "Хадгалах"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
