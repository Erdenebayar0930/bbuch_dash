"use client";

import React, { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { Dropdown } from "@/components/ui/dropdown/Dropdown";

type RowActionsProps = {
  onEdit?: () => void;
  onDelete?: () => void | Promise<void>;
};

const itemClass =
  "block w-full rounded-lg px-3 py-2 text-left text-theme-sm font-medium transition-colors";

export default function RowActions({ onEdit, onDelete }: RowActionsProps) {
  const [isOpen, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(false);
    setConfirming(false);
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await onDelete?.();
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex justify-end">
      <button
        type="button"
        aria-label="Үйлдэл"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
          setConfirming(false);
        }}
        className="dropdown-toggle flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-200"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={close}
        className="absolute right-0 mt-2 w-[190px] p-2"
      >
        {confirming ? (
          <>
            <p className="px-3 pb-2 pt-1 text-theme-xs text-gray-500 dark:text-gray-400">
              Энэ гүйлгээг устгах уу?
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              className={`${itemClass} text-error-600 hover:bg-error-50 disabled:opacity-60 dark:text-error-400 dark:hover:bg-error-500/10`}
            >
              {busy ? "Устгаж байна..." : "Тийм, устгах"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={`${itemClass} text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5`}
            >
              Болих
            </button>
          </>
        ) : (
          <>
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit();
                  close();
                }}
                className={`${itemClass} text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5`}
              >
                Засах
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={`${itemClass} text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10`}
              >
                Устгах
              </button>
            )}
          </>
        )}
      </Dropdown>
    </div>
  );
}
