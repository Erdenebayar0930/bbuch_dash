"use client";

import React, { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import {
  bankLabel,
  bankNames,
  formatAccountNumber,
  type Bank,
  type DonationAccount,
} from "@/data/donationAccounts";
import { useDonationAccounts } from "@/hooks/useDonationAccounts";
import {
  createDonationAccount,
  deleteDonationAccount,
  updateDonationAccount,
  type DonationAccountInput,
} from "@/lib/donationAccounts";

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

const iconButton =
  "flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white";

const empty: DonationAccountInput = {
  title: "",
  number: "",
  bank: "",
  holder: "",
  isTithe: false,
};

type DonationAccountsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Хандивын данснууд — зөвхөн админ нэмж, засаж, устгана.
 *
 * Жагсаалт нь `useDonationAccounts`-ийн кэшээс; өөрчилсний дараа `refresh()`
 * дуудаж Санхүүгийн бусад хэсэг (1/10, Хандив г.м.) шинэ утгаа авна.
 */
export default function DonationAccountsModal({ isOpen, onClose }: DonationAccountsModalProps) {
  const { accounts, loading, refresh } = useDonationAccounts();
  /** `null` — жагсаалт; `"new"` — шинэ; эс бөгөөс засаж буй данс */
  const [editing, setEditing] = useState<DonationAccount | "new" | null>(null);
  const [form, setForm] = useState<DonationAccountInput>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEditing(null);
    setError(null);
    refresh();
  }, [isOpen, refresh]);

  const startEdit = (account: DonationAccount | "new") => {
    setEditing(account);
    setError(null);
    setForm(
      account === "new"
        ? empty
        : {
            title: account.title,
            number: account.number,
            bank: account.bank,
            holder: account.holder,
            isTithe: account.isTithe,
          }
    );
  };

  const set = <K extends keyof DonationAccountInput>(key: K, value: DonationAccountInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return setError("Дансны нэрийг бөглөнө үү.");
    if (!form.number.trim()) return setError("Дансны дугаарыг бөглөнө үү.");

    setSaving(true);
    setError(null);
    try {
      if (editing === "new") await createDonationAccount(form);
      else if (editing) await updateDonationAccount(editing.id, form);
      await refresh();
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (account: DonationAccount) => {
    if (
      !window.confirm(
        `«${account.title}» дансыг устгах уу? Гүйлгээний түүх хадгалагдана, зөвхөн жагсаалтаас хасагдана.`
      )
    ) {
      return;
    }
    setError(null);
    try {
      await deleteDonationAccount(account.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg p-0">
      <div className="p-5">
        <h3 className="pr-12 text-lg font-semibold text-gray-900 dark:text-white">
          {editing === null ? "Хандивын данснууд" : editing === "new" ? "Данс нэмэх" : "Данс засах"}
        </h3>

        {error && (
          <p className="mt-4 rounded-lg bg-error-50 px-3 py-2 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}

        {editing === null ? (
          <>
            <div className="mt-4 flex flex-col gap-2">
              {loading && accounts.length === 0 && (
                <p className="py-6 text-center text-theme-sm text-gray-500">Ачаалж байна...</p>
              )}
              {!loading && accounts.length === 0 && (
                <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-theme-sm text-gray-400 dark:border-white/10">
                  Данс бүртгэгдээгүй байна.
                </p>
              )}
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 dark:border-white/10"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-theme-sm font-semibold text-gray-900 dark:text-white">
                      {account.title}
                      {account.isTithe && (
                        <span className="ml-2 rounded-full bg-accent-600/10 px-2 py-0.5 text-theme-xs font-semibold text-accent-700 dark:text-accent-300">
                          1/10
                        </span>
                      )}
                    </p>
                    <p className="mt-1 break-all font-mono text-theme-sm text-gray-700 dark:text-gray-300">
                      {formatAccountNumber(account.number)}
                    </p>
                    <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                      {[bankLabel(account.bank), account.holder].filter(Boolean).join(" · ") ||
                        "Банк, эзэмшигч оруулаагүй"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(account)}
                    aria-label={`${account.title} засах`}
                    title="Засах"
                    className={iconButton}
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(account)}
                    aria-label={`${account.title} устгах`}
                    title="Устгах"
                    className={`${iconButton} hover:text-error-600 dark:hover:text-error-400`}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-lg border border-gray-200 px-4 text-theme-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Хаах
              </button>
              <button
                type="button"
                onClick={() => startEdit("new")}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-4 text-theme-sm font-medium text-white hover:bg-accent-700"
              >
                <Plus className="h-4 w-4" strokeWidth={2.2} />
                Данс нэмэх
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="account-title" className={labelClass}>
                Дансны нэр (зориулалт) <span className="text-error-500">*</span>
              </label>
              <input
                id="account-title"
                value={form.title}
                onChange={(event) => set("title", event.target.value)}
                maxLength={200}
                placeholder="Илгээлтийн сан"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="account-bank" className={labelClass}>
                Банк
              </label>
              <select
                id="account-bank"
                value={form.bank}
                onChange={(event) => set("bank", event.target.value)}
                className={fieldClass}
              >
                <option value="">Сонгоогүй</option>
                {(Object.keys(bankNames) as Bank[]).map((bank) => (
                  <option key={bank} value={bank}>
                    {bankNames[bank]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="account-holder" className={labelClass}>
                Данс эзэмшигч
              </label>
              <input
                id="account-holder"
                value={form.holder}
                onChange={(event) => set("holder", event.target.value)}
                maxLength={200}
                placeholder="Г.Мөнгөнцэцэг"
                className={fieldClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="account-number" className={labelClass}>
                Дансны дугаар <span className="text-error-500">*</span>
              </label>
              <input
                id="account-number"
                value={form.number}
                onChange={(event) => set("number", event.target.value)}
                maxLength={40}
                placeholder="MN00 0000 0000 0000 0000"
                className={`${fieldClass} font-mono`}
              />
            </div>

            <label className="flex items-start gap-2.5 text-theme-sm text-gray-700 sm:col-span-2 dark:text-gray-300">
              <input
                type="checkbox"
                checked={!!form.isTithe}
                onChange={(event) => set("isTithe", event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-accent-600"
              />
              <span>
                «1/10 ба өргөл» хуудсанд энэ дансыг харуулах
                <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
                  Зөвхөн нэг данс тэмдэглэгдэнэ — өмнөх нь автоматаар болиулна.
                </span>
              </span>
            </label>

            <div className="flex justify-end gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setError(null);
                }}
                className="h-10 rounded-lg border border-gray-200 px-4 text-theme-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Буцах
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-10 rounded-lg bg-accent-600 px-4 text-theme-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
              >
                {saving ? "Хадгалж байна..." : "Хадгалах"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
