"use client";

import React, { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { taskPriorities, taskPriorityLabels } from "@/data/taskOptions";
import {
  createPurchase,
  updatePurchase,
  type Purchase,
  type PurchaseInput,
} from "@/lib/purchases";

type PurchaseFormModalProps = {
  isOpen: boolean;
  /** null бол шинээр нэмнэ */
  purchase: Purchase | null;
  onClose: () => void;
  onSaved: () => void;
};

const emptyInput: PurchaseInput = {
  name: "",
  quantity: 1,
  unit: "ш",
  estimatedPrice: 0,
  priority: "normal",
  note: "",
};

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

export default function PurchaseFormModal({
  isOpen,
  purchase,
  onClose,
  onSaved,
}: PurchaseFormModalProps) {
  const [form, setForm] = useState<PurchaseInput>(emptyInput);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Цонх нээгдэх бүрд засаж буй мөрийн утгаар дүүргэнэ
  useEffect(() => {
    setForm(
      purchase
        ? {
            name: purchase.name,
            quantity: purchase.quantity,
            unit: purchase.unit,
            estimatedPrice: purchase.estimatedPrice,
            priority: purchase.priority,
            note: purchase.note,
          }
        : emptyInput
    );
    setError(null);
  }, [purchase, isOpen]);

  const update = <K extends keyof PurchaseInput>(
    key: K,
    value: PurchaseInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (purchase) {
        await updatePurchase(purchase.id, form);
      } else {
        await createPurchase(form);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error("Хүсэлт хадгалахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md p-0">
      <form onSubmit={handleSubmit} className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {purchase ? "Хүсэлт засах" : "Худалдан авах хүсэлт"}
        </h3>

        <div className="mt-5 grid gap-4">
          <div>
            <label htmlFor="purchase-name" className={labelClass}>
              Бараа <span className="text-error-500">*</span>
            </label>
            <input
              id="purchase-name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Жишээ нь: Цэвэрлэгээний бодис"
              className={fieldClass}
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="purchase-quantity" className={labelClass}>
                Тоо хэмжээ
              </label>
              <input
                id="purchase-quantity"
                type="number"
                min={0}
                value={form.quantity}
                onChange={(event) =>
                  update("quantity", Math.max(0, Number(event.target.value) || 0))
                }
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="purchase-unit" className={labelClass}>
                Нэгж
              </label>
              <input
                id="purchase-unit"
                value={form.unit}
                onChange={(event) => update("unit", event.target.value)}
                placeholder="ш"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="purchase-price" className={labelClass}>
                Нэгж үнэ, ₮ <span className="text-gray-400">(таамаг)</span>
              </label>
              <input
                id="purchase-price"
                type="number"
                min={0}
                value={form.estimatedPrice}
                onChange={(event) =>
                  update(
                    "estimatedPrice",
                    Math.max(0, Number(event.target.value) || 0)
                  )
                }
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="purchase-priority" className={labelClass}>
                Ач холбогдол
              </label>
              <select
                id="purchase-priority"
                value={form.priority}
                onChange={(event) =>
                  update("priority", event.target.value as PurchaseInput["priority"])
                }
                className={fieldClass}
              >
                {taskPriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {taskPriorityLabels[priority]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="purchase-note" className={labelClass}>
              Тэмдэглэл <span className="text-gray-400">(заавал биш)</span>
            </label>
            <textarea
              id="purchase-note"
              value={form.note}
              onChange={(event) => update("note", event.target.value)}
              rows={2}
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
            Буцах
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