"use client";

import React, { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import Checkbox from "@/components/form/input/Checkbox";
import { Modal } from "@/components/ui/modal";
import { aimags as aimagOptions } from "@/data/profileOptions";
import { setUserChurchInfo, type AppUser } from "@/lib/users";

const MAX_CALLINGS = 5;

type ChurchInfoModalProps = {
  user: AppUser | null;
  onClose: () => void;
  onSaved: (uid: string, patch: { aimags: string[]; callings: string[] }) => void;
};

/** Тухайн хэрэглэгчийн дуудлага, аймгийг оноох админы цонх. */
export default function ChurchInfoModal({
  user,
  onClose,
  onSaved,
}: ChurchInfoModalProps) {
  const [aimags, setAimags] = useState<string[]>([]);
  const [callings, setCallings] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setAimags(user.aimags);
      setCallings(user.callings);
      setDraft("");
      setError("");
    }
  }, [user]);

  const toggleAimag = (value: string, checked: boolean) => {
    setAimags((prev) =>
      checked ? [...prev, value] : prev.filter((item) => item !== value)
    );
  };

  const addCalling = (event: React.FormEvent) => {
    event.preventDefault();

    const value = draft.trim();
    if (!value || callings.includes(value)) return;
    if (callings.length >= MAX_CALLINGS) {
      setError(`Дуудлага дээд тал нь ${MAX_CALLINGS} байна.`);
      return;
    }

    setCallings((prev) => [...prev, value]);
    setDraft("");
    setError("");
  };

  const removeCalling = (value: string) => {
    setCallings((prev) => prev.filter((item) => item !== value));
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setError("");

    try {
      await setUserChurchInfo(user.uid, { aimags, callings });
      onSaved(user.uid, { aimags, callings });
      onClose();
    } catch (err) {
      console.error("Чуулганы мэдээлэл хадгалахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      "Нэр оруулаагүй"
    : "";

  return (
    <Modal isOpen={!!user} onClose={onClose} className="max-w-lg p-6">
      <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
        Чуулганы мэдээлэл
      </h3>
      <p className="mt-0.5 text-theme-sm text-gray-500 dark:text-gray-400">
        {fullName}
      </p>

      <div className="mt-5">
        <p className="mb-2 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
          Аймаг
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {aimagOptions.map((option) => (
            <Checkbox
              key={option.value}
              id={`aimag-${option.value}`}
              label={option.label}
              checked={aimags.includes(option.value)}
              onChange={(checked) => toggleAimag(option.value, checked)}
            />
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
          Дуудлага (дээд тал нь {MAX_CALLINGS})
        </p>

        <ul className="flex flex-wrap gap-2">
          {callings.map((calling) => (
            <li key={calling}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 py-1 pl-3 pr-1.5 text-theme-xs font-medium text-accent-700 dark:bg-accent-500/15 dark:text-accent-300">
                {calling}
                <button
                  type="button"
                  onClick={() => removeCalling(calling)}
                  aria-label={`«${calling}» дуудлагыг хасах`}
                  className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-accent-100 dark:hover:bg-accent-500/25"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.2} />
                </button>
              </span>
            </li>
          ))}
        </ul>

        <form onSubmit={addCalling} className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Жишээ нь: Магтаалын багийн ахлагч"
            maxLength={100}
            disabled={callings.length >= MAX_CALLINGS}
            className="h-10 min-w-[200px] flex-1 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
          />
          <button
            type="submit"
            disabled={!draft.trim() || callings.length >= MAX_CALLINGS}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            Нэмэх
          </button>
        </form>
      </div>

      {error && (
        <p className="mt-4 text-theme-xs text-error-600 dark:text-error-400">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Хадгалж байна..." : "Хадгалах"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
        >
          Цуцлах
        </button>
      </div>
    </Modal>
  );
}
