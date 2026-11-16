"use client";

import React, { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import {
  createSupply,
  updateSupply,
  type Supply,
  type SupplyInput,
  type SupplyKind,
} from "@/lib/supplies";
import DateInput from "@/components/form/DateInput";

type SupplyModalProps = {
  isOpen: boolean;
  /** null бол шинэ бүртгэл */
  supply: Supply | null;
  /** Өмнө бичсэн зориулалтууд — санал болгоход */
  purposes: string[];
  onClose: () => void;
  onSaved: (supply: Supply) => void;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar" }).format(new Date());

const emptyInput = (): SupplyInput => ({
  kind: "money",
  title: "Мөнгө",
  purpose: "",
  amount: null,
  quantity: 1,
  giver: "",
  receivedOn: today(),
  note: "",
});

/** Орж ирсэн мөнгө / эд зүйлийг бүртгэх, засах цонх — зөвхөн админ. */
export default function SupplyModal({
  isOpen,
  supply,
  purposes,
  onClose,
  onSaved,
}: SupplyModalProps) {
  const [form, setForm] = useState<SupplyInput>(emptyInput);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (supply) {
      const { id: _id, createdAt: _createdAt, ...rest } = supply;
      void _id;
      void _createdAt;
      setForm(rest);
    } else {
      setForm(emptyInput());
    }
  }, [isOpen, supply]);

  const set = <K extends keyof SupplyInput>(key: K, value: SupplyInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setKind = (kind: SupplyKind) =>
    setForm((prev) => ({
      ...prev,
      kind,
      // Төрөл солиход анхдагч нэрийг л солино — гараар бичсэнийг хөндөхгүй
      title:
        kind === "money" && !prev.title.trim()
          ? "Мөнгө"
          : kind === "item" && prev.title === "Мөнгө"
            ? ""
            : prev.title,
      quantity: kind === "money" ? 1 : prev.quantity,
    }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.title.trim()) return setError("Юу орж ирснийг бичнэ үү.");
    if (form.kind === "money" && !form.amount) return setError("Мөнгөний дүнг оруулна уу.");

    setSaving(true);
    setError(null);
    try {
      const saved = supply ? await updateSupply(supply.id, form) : await createSupply(form);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  const isMoney = form.kind === "money";

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg p-0">
      <form onSubmit={handleSubmit} className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {supply ? "Бүртгэл засах" : "Хангамж бүртгэх"}
        </h3>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className={labelClass}>Төрөл</p>
            <div className="flex gap-2">
              {(
                [
                  ["money", "Мөнгө"],
                  ["item", "Эд зүйл"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  aria-pressed={form.kind === value}
                  className={`flex-1 rounded-lg border px-4 py-2.5 text-theme-sm font-medium transition-colors ${
                    form.kind === value
                      ? "border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="supply-title" className={labelClass}>
              Юу <span className="text-error-500">*</span>
            </label>
            <input
              id="supply-title"
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
              maxLength={255}
              placeholder={isMoney ? "Мөнгө" : "Жишээ нь: Портер машин"}
              className={fieldClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="supply-purpose" className={labelClass}>
              Зориулалт
            </label>
            <input
              id="supply-purpose"
              list="supply-purposes"
              value={form.purpose}
              onChange={(event) => set("purpose", event.target.value)}
              maxLength={255}
              placeholder="Жишээ нь: Портер авах"
              className={fieldClass}
            />
            <datalist id="supply-purposes">
              {purposes.map((purpose) => (
                <option key={purpose} value={purpose} />
              ))}
            </datalist>
          </div>

          <div className={isMoney ? "sm:col-span-2" : ""}>
            <label htmlFor="supply-amount" className={labelClass}>
              {isMoney ? (
                <>
                  Дүн, ₮ <span className="text-error-500">*</span>
                </>
              ) : (
                <>
                  Үнэлгээ, ₮ <span className="text-gray-400">(заавал биш)</span>
                </>
              )}
            </label>
            <input
              id="supply-amount"
              type="number"
              inputMode="numeric"
              min={0}
              value={form.amount ?? ""}
              onChange={(event) => {
                const value = Math.max(0, Math.trunc(Number(event.target.value) || 0));
                set("amount", value || null);
              }}
              className={fieldClass}
            />
          </div>

          {!isMoney && (
            <div>
              <label htmlFor="supply-quantity" className={labelClass}>
                Тоо ширхэг
              </label>
              <input
                id="supply-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                value={form.quantity}
                onChange={(event) =>
                  set("quantity", Math.max(1, Math.trunc(Number(event.target.value) || 1)))
                }
                className={fieldClass}
              />
            </div>
          )}

          <div>
            <label htmlFor="supply-giver" className={labelClass}>
              Хэнээс
            </label>
            <input
              id="supply-giver"
              value={form.giver}
              onChange={(event) => set("giver", event.target.value)}
              maxLength={255}
              placeholder="Заавал биш"
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="supply-date" className={labelClass}>
              Огноо <span className="text-error-500">*</span>
            </label>
            <DateInput
              id="supply-date"
              value={form.receivedOn}
              max={today()}
              onChange={(event) => set("receivedOn", event.target.value)}
              className={fieldClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="supply-note" className={labelClass}>
              Тэмдэглэл
            </label>
            <textarea
              id="supply-note"
              value={form.note}
              onChange={(event) => set("note", event.target.value)}
              rows={2}
              maxLength={2000}
              className={`${fieldClass} h-auto py-2.5`}
            />
          </div>
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
            Болих
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Хадгалж байна..." : "Хадгалах"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
