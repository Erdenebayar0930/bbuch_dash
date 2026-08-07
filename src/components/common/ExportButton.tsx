"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";

import { downloadExport } from "@/lib/exportFile";

type ExportButtonProps = {
  /** Серверийн багцын түлхүүр — /api/export/<dataset> */
  dataset: string;
  /** Товчны бичиг — өгөхгүй бол "Excel татах" */
  label?: string;
};

/**
 * Бүртгэлийг .xlsx болгон татах товч.
 *
 * Алдааг товчны доор шууд харуулна — хуудас бүрт тусдаа алдааны талбар
 * барихгүйн тулд.
 */
export default function ExportButton({ dataset, label }: ExportButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleClick = async () => {
    setBusy(true);
    setError("");

    try {
      await downloadExport(dataset);
    } catch (err) {
      console.error("Excel татахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Татаж чадсангүй.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
        ) : (
          <FileSpreadsheet className="h-4 w-4" strokeWidth={1.8} />
        )}
        {label ?? "Excel татах"}
      </button>

      {error && (
        <span className="text-theme-xs text-error-600 dark:text-error-400">
          {error}
        </span>
      )}
    </div>
  );
}