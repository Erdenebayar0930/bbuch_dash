"use client";

import React, { useState } from "react";
import { Check, PenLine, Plus } from "lucide-react";

import TransactionFormModal from "@/components/finance/TransactionFormModal";
import { type TransactionInput } from "@/data/finance";
import { createTransaction } from "@/lib/transactions";

/**
 * Нэг гүйлгээг гараар бүртгэнэ.
 *
 * Бэлнээр авсан өргөл, банк дамжаагүй зарлага зэрэг хуулгад ордоггүй
 * гүйлгээнд зориулав — хуулгаас уншсан мөрөөс ялгаатай нь давхардлын
 * түлхүүргүй (`import_key` нь NULL) тул хожим хуулгатай мөргөлдөхгүй.
 */
export default function ManualEntry() {
  const [isOpen, setOpen] = useState(false);
  const [added, setAdded] = useState(0);

  const handleSubmit = async (input: TransactionInput) => {
    await createTransaction(input);
    setAdded((prev) => prev + 1);
  };

  return (
    <div className="surface flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">
          <PenLine className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            Гараар нэмэх
          </h3>
          <p className="mt-0.5 text-theme-sm text-gray-500 dark:text-gray-400">
            Бэлнээр авсан өргөл, хуулгад ороогүй гүйлгээг нэг нэгээр нь
          </p>

          {added > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-theme-sm text-success-600 dark:text-success-400">
              <Check className="h-4 w-4" strokeWidth={2.2} />
              {added} гүйлгээ нэмэгдлээ
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
      >
        <Plus className="h-4 w-4" strokeWidth={2.2} />
        Гүйлгээ нэмэх
      </button>

      <TransactionFormModal
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
