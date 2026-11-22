"use client";

import React, { useState } from "react";
import { BarChart3, Plus, X } from "lucide-react";

import type { TaskUpdate } from "@/lib/taskProgress";

const MAX_OPTIONS = 10;

/** Маягтын санал асуулга — хоосон сонголтуудыг илгээхдээ хасна */
export type PollDraft = { question: string; options: string[]; multi: boolean };

export const emptyPoll = (): PollDraft => ({ question: "", options: ["", ""], multi: false });

/** Илгээхэд бэлэн эсэх — асуулт ба дор хаяж 2 сонголт */
export const pollReady = (poll: PollDraft) =>
  poll.question.trim().length > 0 && poll.options.filter((option) => option.trim()).length >= 2;

const inputClass =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90";

/** Санал асуулга үүсгэх хэсэг — явцын маягт дотор. */
export function PollEditor({
  value,
  onChange,
  onRemove,
  disabled,
}: {
  value: PollDraft;
  onChange: (poll: PollDraft) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const setOption = (index: number, text: string) =>
    onChange({ ...value, options: value.options.map((option, i) => (i === index ? text : option)) });

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-accent-200 bg-accent-50/40 p-3 dark:border-accent-500/30 dark:bg-accent-500/5">
      <div className="flex items-center gap-2 text-theme-sm font-medium text-accent-700 dark:text-accent-300">
        <BarChart3 className="h-4 w-4" strokeWidth={2} />
        Poll — санал асуулга
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label="Санал асуулгыг хасах"
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <input
        value={value.question}
        onChange={(event) => onChange({ ...value, question: event.target.value })}
        placeholder="Асуулт"
        maxLength={200}
        disabled={disabled}
        className={inputClass}
      />

      {value.options.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={option}
            onChange={(event) => setOption(index, event.target.value)}
            placeholder={`Сонголт ${index + 1}`}
            maxLength={200}
            disabled={disabled}
            className={inputClass}
          />
          {value.options.length > 2 && (
            <button
              type="button"
              onClick={() => onChange({ ...value, options: value.options.filter((_, i) => i !== index) })}
              disabled={disabled}
              aria-label={`Сонголт ${index + 1}-ийг хасах`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        {value.options.length < MAX_OPTIONS && (
          <button
            type="button"
            onClick={() => onChange({ ...value, options: [...value.options, ""] })}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-theme-sm font-medium text-accent-600 hover:underline dark:text-accent-400"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Сонголт нэмэх
          </button>
        )}
        <label className="ml-auto flex items-center gap-2 text-theme-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={value.multi}
            onChange={(event) => onChange({ ...value, multi: event.target.checked })}
            disabled={disabled}
            className="h-4 w-4 accent-accent-600"
          />
          Олон сонголт зөвшөөрөх
        </label>
      </div>
    </div>
  );
}

/** Санал асуулгын дүн ба санал өгөх хэсэг — явцын карт доор. */
export function PollView({
  update,
  onVote,
}: {
  update: TaskUpdate;
  onVote: (optionIds: string[]) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const poll = update.poll;
  if (!poll) return null;

  const counts = poll.options.map((option) => update.voters[option.id]?.length ?? 0);
  const voterCount = new Set(Object.values(update.voters).flat()).size;
  const max = Math.max(1, ...counts);

  const toggle = async (optionId: string) => {
    const mine = update.myVotes;
    const next = poll.multi
      ? mine.includes(optionId)
        ? mine.filter((id) => id !== optionId)
        : [...mine, optionId]
      : mine.includes(optionId)
        ? []
        : [optionId];

    setBusy(true);
    try {
      await onVote(next);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Санал өгөхөд алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-4 mt-3 rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-gray-900 dark:text-white/90">
        <BarChart3 className="h-4 w-4 text-accent-600 dark:text-accent-400" strokeWidth={2} />
        {poll.question}
      </p>
      <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">
        {poll.multi ? "Олон сонголт" : "Нэг сонголт"} · {voterCount} хүн санал өгсөн
      </p>

      <ul className="mt-2.5 flex flex-col gap-1.5">
        {poll.options.map((option, index) => {
          const chosen = update.myVotes.includes(option.id);
          const names = update.voters[option.id] ?? [];
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => toggle(option.id)}
                disabled={busy}
                title={names.length > 0 ? names.join(", ") : undefined}
                aria-pressed={chosen}
                className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-theme-sm transition-colors disabled:opacity-70 ${
                  chosen
                    ? "border-accent-500 text-accent-800 dark:text-accent-200"
                    : "border-gray-200 text-gray-700 hover:border-accent-300 dark:border-white/10 dark:text-gray-300"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 ${chosen ? "bg-accent-100 dark:bg-accent-500/20" : "bg-gray-100 dark:bg-white/5"}`}
                  style={{ width: `${(counts[index] / max) * 100}%` }}
                />
                <span className="relative flex items-center gap-2">
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                      poll.multi ? "rounded" : "rounded-full"
                    } ${chosen ? "border-accent-600 bg-accent-600" : "border-gray-300 dark:border-white/30"}`}
                  />
                  <span className="min-w-0 flex-1">{option.text}</span>
                  <span className="shrink-0 font-medium tabular-nums">{counts[index]}</span>
                </span>
              </button>
              {names.length > 0 && (
                <p className="mt-0.5 truncate pl-1 text-[11px] text-gray-400">{names.join(", ")}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
