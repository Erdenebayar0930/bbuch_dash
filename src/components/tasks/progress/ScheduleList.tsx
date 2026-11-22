"use client";

import React, { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";

import DateInput from "@/components/form/DateInput";
import type { ScheduleItem } from "@/lib/taskProgress";

type ScheduleListProps = {
  items: ScheduleItem[];
  canManage: boolean;
  onAdd: (input: { title: string; startDate: string; endDate: string; note: string }) => Promise<void>;
  onToggle: (item: ScheduleItem) => Promise<void>;
  onDelete: (item: ScheduleItem) => Promise<void>;
};

const fieldClass =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90";

const range = (item: ScheduleItem) =>
  item.endDate && item.endDate !== item.startDate ? `${item.startDate} — ${item.endDate}` : item.startDate;

/**
 * Даалгаврын ажлын хуваарь — үе шат бүр огноотой. Хийгдсэн гэж тэмдэглэх,
 * нэмэх, устгах нь тухайн аймгийн гишүүн, хариуцагч, хамтрагчид.
 */
export default function ScheduleList({ items, canManage, onAdd, onToggle, onDelete }: ScheduleListProps) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !startDate) return;
    void run(async () => {
      await onAdd({ title: title.trim(), startDate, endDate: endDate || startDate, note: note.trim() });
      setTitle("");
      setStartDate("");
      setEndDate("");
      setNote("");
    });
  };

  const doneCount = items.filter((item) => item.done).length;

  return (
    <div className="flex flex-col gap-4">
      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
            <div
              className="h-full rounded-full bg-success-500 transition-all"
              style={{ width: `${(doneCount / items.length) * 100}%` }}
            />
          </div>
          <span className="text-theme-xs text-gray-500 dark:text-gray-400">
            {doneCount}/{items.length} хийгдсэн
          </span>
        </div>
      )}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-theme-sm text-gray-400 dark:border-white/10">
          Хуваарь гаргаагүй байна.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-white/10"
            >
              <button
                type="button"
                onClick={() => run(() => onToggle(item))}
                disabled={!canManage || busy}
                aria-pressed={item.done}
                aria-label={item.done ? "Хийгдээгүй болгох" : "Хийгдсэн гэж тэмдэглэх"}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors disabled:cursor-default ${
                  item.done
                    ? "border-success-500 bg-success-500 text-white"
                    : "border-gray-300 dark:border-white/30"
                }`}
              >
                {item.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-theme-sm font-medium ${
                    item.done ? "text-gray-400 line-through" : "text-gray-900 dark:text-white/90"
                  }`}
                >
                  {item.title}
                </p>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">{range(item)}</p>
                {item.note && (
                  <p className="mt-1 whitespace-pre-line text-theme-xs text-gray-600 dark:text-gray-300">{item.note}</p>
                )}
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`«${item.title}» үе шатыг устгах уу?`)) void run(() => onDelete(item));
                  }}
                  disabled={busy}
                  aria-label={`${item.title} устгах`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form
          onSubmit={submit}
          className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-white/10"
        >
          <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">Үе шат нэмэх</p>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Үе шатын нэр — жишээ нь: Материал бэлтгэх"
            maxLength={255}
            className={fieldClass}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-theme-xs text-gray-500 dark:text-gray-400">
              Эхлэх
              <DateInput value={startDate} onChange={(event) => setStartDate(event.target.value)} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1 text-theme-xs text-gray-500 dark:text-gray-400">
              Дуусах (заавал биш)
              <DateInput
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
                className={fieldClass}
              />
            </label>
          </div>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Тэмдэглэл (заавал биш)"
            maxLength={2000}
            className={fieldClass}
          />
          {error && <p className="text-theme-xs text-error-600 dark:text-error-400">{error}</p>}
          <button
            type="submit"
            disabled={busy || !title.trim() || !startDate}
            className="inline-flex h-9 items-center justify-center gap-1.5 self-end rounded-lg bg-accent-600 px-4 text-theme-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            Нэмэх
          </button>
        </form>
      )}
    </div>
  );
}
