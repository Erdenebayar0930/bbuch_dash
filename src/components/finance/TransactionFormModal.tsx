"use client";

import React, { useMemo, useState } from "react";

import { Modal } from "@/components/ui/modal";
import {
  expenseCategories,
  incomeCategories,
  type Transaction,
  type TransactionInput,
  type TransactionStatus,
  type TransactionType,
} from "@/data/finance";

type TransactionFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Утга өгвөл засварлах горим */
  editing?: Transaction | null;
  onSubmit: (input: TransactionInput) => Promise<void>;
};

type FormState = {
  date: string;
  type: TransactionType;
  category: string;
  description: string;
  amount: string;
  status: TransactionStatus;
};

const statusOptions: { value: TransactionStatus; label: string }[] = [
  { value: "approved", label: "Батлагдсан" },
  { value: "pending", label: "Хүлээгдэж буй" },
  { value: "rejected", label: "Цуцлагдсан" },
];

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-theme-sm text-gray-800 shadow-theme-xs transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

function initialForm(editing?: Transaction | null): FormState {
  if (editing) {
    return {
      date: editing.date,
      type: editing.type,
      category: editing.category,
      description: editing.description,
      amount: String(editing.amount),
      status: editing.status,
    };
  }

  return {
    date: "",
    type: "income",
    category: incomeCategories[0],
    description: "",
    amount: "",
    status: "approved",
  };
}

/**
 * Гадна бүрхүүл — хаалттай үед юу ч render хийхгүй тул дараагийн удаа
 * нээхэд маягт цоо шинээр эхэлнэ.
 */
export default function TransactionFormModal({
  isOpen,
  onClose,
  editing,
  onSubmit,
}: TransactionFormModalProps) {
  if (!isOpen) return null;

  return (
    <TransactionForm editing={editing} onClose={onClose} onSubmit={onSubmit} />
  );
}

function TransactionForm({
  onClose,
  editing,
  onSubmit,
}: Omit<TransactionFormModalProps, "isOpen">) {
  const [form, setForm] = useState<FormState>(() => initialForm(editing));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(
    () => (form.type === "income" ? incomeCategories : expenseCategories),
    [form.type]
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const changeType = (type: TransactionType) => {
    const list = type === "income" ? incomeCategories : expenseCategories;
    setForm((prev) => ({ ...prev, type, category: list[0] }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const amount = Number(form.amount);

    if (!form.date) return setError("Огноог сонгоно уу.");
    if (!form.description.trim()) return setError("Тайлбарыг бөглөнө үү.");
    if (!Number.isFinite(amount) || amount <= 0) {
      return setError("Дүн 0-ээс их тоо байх ёстой.");
    }

    setSaving(true);
    setError(null);

    try {
      await onSubmit({
        date: form.date,
        type: form.type,
        category: form.category,
        description: form.description.trim(),
        amount,
        status: form.status,
      });
      onClose();
    } catch (submitError) {
      console.error("Гүйлгээ хадгалахад алдаа гарлаа:", submitError);
      setError("Хадгалахад алдаа гарлаа. Дахин оролдоно уу.");
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      className="mx-4 max-w-[560px] p-6 lg:p-7"
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {editing ? "Гүйлгээ засах" : "Гүйлгээ нэмэх"}
      </h3>
      <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
        Орлого, зарлагын бүртгэлийн мэдээллийг оруулна уу.
      </p>

      <form onSubmit={handleSubmit} className="mt-6">
        {/* Төрөл */}
        <div className="mb-4">
          <span className={labelClass}>Төрөл</span>
          <div className="flex gap-2">
            {(["income", "expense"] as TransactionType[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => changeType(value)}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-theme-sm font-medium transition-colors ${
                  form.type === value
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
                }`}
              >
                {value === "income" ? "Орлого" : "Зарлага"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tx-date" className={labelClass}>
              Огноо
            </label>
            <input
              id="tx-date"
              type="date"
              value={form.date}
              onChange={(event) => update("date", event.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="tx-amount" className={labelClass}>
              Дүн (₮)
            </label>
            <input
              id="tx-amount"
              type="number"
              min="0"
              step="1000"
              inputMode="numeric"
              value={form.amount}
              onChange={(event) => update("amount", event.target.value)}
              placeholder="0"
              className={`${fieldClass} num`}
            />
          </div>

          <div>
            <label htmlFor="tx-category" className={labelClass}>
              Ангилал
            </label>
            <select
              id="tx-category"
              value={form.category}
              onChange={(event) => update("category", event.target.value)}
              className={fieldClass}
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tx-status" className={labelClass}>
              Төлөв
            </label>
            <select
              id="tx-status"
              value={form.status}
              onChange={(event) =>
                update("status", event.target.value as TransactionStatus)
              }
              className={fieldClass}
            >
              {statusOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="tx-description" className={labelClass}>
              Тайлбар
            </label>
            <input
              id="tx-description"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Жишээ нь: Бараа борлуулалт — Их дэлгүүрийн гэрээ"
              className={fieldClass}
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 text-theme-sm text-error-500">{error}</p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            Цуцлах
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
