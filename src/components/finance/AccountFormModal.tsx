"use client";

import React, { useState } from "react";

import { Modal } from "@/components/ui/modal";
import { bankNames, type DonationAccount } from "@/data/donationAccounts";
import {
  createDonationAccount,
  updateDonationAccount,
} from "@/lib/donationAccounts";

type AccountFormModalProps = {
  isOpen: boolean;
  /** Утга өгвөл засварлах горим */
  editing?: DonationAccount | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

export default function AccountFormModal(props: AccountFormModalProps) {
  if (!props.isOpen) return null;
  return <AccountForm {...props} />;
}

function AccountForm({
  editing,
  onClose,
  onSaved,
}: Omit<AccountFormModalProps, "isOpen">) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [number, setNumber] = useState(editing?.number ?? "");
  const [bank, setBank] = useState(editing?.bank ?? "");
  const [holder, setHolder] = useState(editing?.holder ?? "");
  const [isTithe, setTithe] = useState(editing?.isTithe ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim()) return setError("Дансны нэрийг бөглөнө үү.");
    if (!number.trim()) return setError("Дансны дугаарыг бөглөнө үү.");

    setSaving(true);
    setError("");

    const input = { title, number, bank, holder, isTithe };

    try {
      if (editing) await updateDonationAccount(editing.id, input);
      else await createDonationAccount(input);

      await onSaved();
      onClose();
    } catch (err) {
      console.error("Данс хадгалахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Хадгалж чадсангүй.");
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} className="mx-4 max-w-[520px] p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {editing ? "Данс засах" : "Данс нэмэх"}
      </h3>
      <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
        Энэ данс бүх хүнд харагдана. Гүйлгээ нь ч мөн анхнаасаа нээлттэй —
        хязгаарлах бол дараа нь «Эрх оноох»-оор аймаг эсвэл хүн сонгоно.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="acc-title" className={labelClass}>
            Дансны нэр
          </label>
          <input
            id="acc-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Жишээ нь: 1/10 ба өргөл"
            maxLength={200}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="acc-number" className={labelClass}>
            Дансны дугаар
          </label>
          <input
            id="acc-number"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="MN100005005312334127"
            maxLength={40}
            className={`${fieldClass} font-mono`}
          />
          {editing && (
            <p className="mt-1 text-theme-xs text-warning-600 dark:text-warning-400">
              Дугаарыг солиход өмнөх гүйлгээнүүд нь энэ данснаас сална —
              гүйлгээ дугаараар холбогддог.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="acc-bank" className={labelClass}>
              Банк
            </label>
            <select
              id="acc-bank"
              value={bank}
              onChange={(event) => setBank(event.target.value)}
              className={fieldClass}
            >
              <option value="">Сонгоогүй</option>
              {Object.entries(bankNames).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="acc-holder" className={labelClass}>
              Данс эзэмшигч
            </label>
            <input
              id="acc-holder"
              value={holder}
              onChange={(event) => setHolder(event.target.value)}
              maxLength={200}
              className={fieldClass}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 px-3.5 py-3 dark:border-white/10">
          <input
            type="checkbox"
            checked={isTithe}
            onChange={(event) => setTithe(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500/30 dark:border-white/20 dark:bg-white/10"
          />
          <span>
            <span className="block text-theme-sm font-medium text-gray-800 dark:text-white/90">
              «1/10 ба өргөл» тайлангийн данс
            </span>
            <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
              Хуваарилалтын хуудас энэ дансыг харуулна. Нэг л данс тэмдэглэгдэх
              тул өмнөхийнх нь автоматаар арилна.
            </span>
          </span>
        </label>

        {error && <p className="text-theme-sm text-error-500">{error}</p>}

        <div className="mt-2 flex items-center justify-end gap-3">
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
