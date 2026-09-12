"use client";

import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { addMetaItem, deleteMetaItem, type RefItem } from "@/lib/assets";

type Kind = "warehouse" | "category";

type MetaManagerModalProps = {
  isOpen: boolean;
  warehouses: RefItem[];
  categories: RefItem[];
  onClose: () => void;
  onChanged: () => void;
};

const labels: Record<Kind, { title: string; placeholder: string }> = {
  warehouse: { title: "Агуулах", placeholder: "Шинэ агуулахын нэр" },
  category: { title: "Төрөл", placeholder: "Шинэ төрлийн нэр" },
};

/** Агуулах ба төрлийн жагсаалтыг нэмэх / устгах цонх (зөвхөн админ) */
export default function MetaManagerModal({
  isOpen,
  warehouses,
  categories,
  onClose,
  onChanged,
}: MetaManagerModalProps) {
  const [drafts, setDrafts] = useState<Record<Kind, string>>({
    warehouse: "",
    category: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);

    try {
      await action();
      onChanged();
    } catch (err) {
      console.error("Лавлах жагсаалт өөрчлөхөд алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (kind: Kind) => {
    const name = drafts[kind].trim();
    if (!name) return;

    await run(async () => {
      await addMetaItem(kind, name);
      setDrafts((prev) => ({ ...prev, [kind]: "" }));
    });
  };

  const section = (kind: Kind, items: RefItem[]) => (
    <div>
      <p className="mb-2 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        {labels[kind].title}
        <span className="ml-1.5 text-theme-xs font-normal text-gray-400">
          {items.length}
        </span>
      </p>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2 dark:border-white/10"
          >
            <span className="min-w-0 flex-1 truncate text-theme-sm text-gray-700 dark:text-gray-300">
              {item.name}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => deleteMetaItem(kind, item.id))}
              aria-label={`${item.name} устгах`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-error-500 transition-colors hover:bg-error-50 disabled:opacity-50 dark:hover:bg-error-500/10"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={drafts[kind]}
          onChange={(event) =>
            setDrafts((prev) => ({ ...prev, [kind]: event.target.value }))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAdd(kind);
            }
          }}
          placeholder={labels[kind].placeholder}
          maxLength={60}
          className="h-11 flex-1 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
        />
        <button
          type="button"
          disabled={busy || !drafts[kind].trim()}
          onClick={() => handleAdd(kind)}
          className="flex h-11 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Нэмэх
        </button>
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg p-0">
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Агуулах ба төрөл
        </h3>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Устгасан ч бүртгэгдсэн эд хөрөнгө арилахгүй — зөвхөн тэр талбар нь
          хоосон болно.
        </p>

        <div className="mt-5 grid gap-5">
          {section("warehouse", warehouses)}
          {section("category", categories)}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700"
          >
            Хаах
          </button>
        </div>
      </div>
    </Modal>
  );
}
