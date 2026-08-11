"use client";

import React, { useState } from "react";
import { Plus, X } from "lucide-react";

import { addTithePattern, removeTithePattern } from "@/lib/statement";

type TithePatternEditorProps = {
  patterns: string[];
  /** Жагсаалт өөрчлөгдөхөд эцэг нь дахин ангилахын тулд */
  onChange: (patterns: string[]) => void;
};

/**
 * «1/10» гэж таних загваруудыг удирдана.
 *
 * Хүн бүр өөрөөр бичдэг тул жагсаалтыг кодод хатуу бичихгүй — энд нэмсэн үг
 * гүйлгээний утганд агуулагдвал тэр мөр 1/10 болно. Харьцуулахдаа зай, цэг,
 * ташуу зураасыг үл тооно: «1/10», «1 / 10», «1-10» гурвуулаа ижил.
 */
export default function TithePatternEditor({
  patterns,
  onChange,
}: TithePatternEditorProps) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (action: () => Promise<string[]>) => {
    setBusy(true);
    setError("");

    try {
      onChange(await action());
    } catch (err) {
      console.error("Загвар шинэчлэхэд алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Шинэчилж чадсангүй.");
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();

    const value = draft.trim();
    if (!value) return;

    await run(() => addTithePattern(value));
    setDraft("");
  };

  return (
    <div className="surface p-5">
      <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
        1/10 таних загвар
      </h3>
      <p className="mt-0.5 text-theme-sm text-gray-500 dark:text-gray-400">
        Гүйлгээний утганд эдгээрийн аль нэг нь агуулагдвал 1/10, эс бөгөөс
        өргөл гэж ялгана. Зай, цэг, ташуу зураасыг үл тооно.
      </p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {patterns.length === 0 && (
          <li className="text-theme-sm text-gray-400">
            Загвар алга — бүх гүйлгээ өргөл болно.
          </li>
        )}

        {patterns.map((pattern) => (
          <li key={pattern}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 py-1 pl-3 pr-1.5 text-theme-xs font-medium text-accent-700 dark:bg-accent-500/15 dark:text-accent-300">
              {pattern}
              <button
                type="button"
                onClick={() => run(() => removeTithePattern(pattern))}
                disabled={busy}
                aria-label={`«${pattern}» загварыг хасах`}
                className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-accent-100 disabled:opacity-50 dark:hover:bg-accent-500/25"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
            </span>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Жишээ нь: аравны нэг"
          maxLength={60}
          className="h-10 min-w-[200px] flex-1 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} />
          Нэмэх
        </button>
      </form>

      {error && (
        <p className="mt-2 text-theme-xs text-error-600 dark:text-error-400">
          {error}
        </p>
      )}
    </div>
  );
}
