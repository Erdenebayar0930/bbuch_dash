"use client";

import React, { useState } from "react";
import { Plus, X } from "lucide-react";

type SettingsListFieldProps = {
  id: string;
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  /** Түгээмэл утгууд — дарж шууд нэмнэ */
  suggestions?: string[];
  className?: string;
};

const MAX_ITEMS = 20;
const MAX_LENGTH = 60;

/**
 * Чөлөөт бичвэрийн жагсаалт — бичээд Enter (эсвэл «Нэмэх»), шошгон дээрх ×-ээр
 * хасна. Ярьдаг хэл, тоглодог хөгжим зэрэгт.
 */
export default function SettingsListField({
  id,
  label,
  value,
  onChange,
  placeholder,
  suggestions = [],
  className = "",
}: SettingsListFieldProps) {
  const [draft, setDraft] = useState("");

  const has = (item: string) => value.some((existing) => existing.toLowerCase() === item.toLowerCase());

  const add = (raw: string) => {
    const item = raw.replace(/\s+/g, " ").trim().slice(0, MAX_LENGTH);
    if (!item || has(item) || value.length >= MAX_ITEMS) return;
    onChange([...value, item]);
    setDraft("");
  };

  const unused = suggestions.filter((item) => !has(item));

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>

      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 rounded-full bg-accent-50 py-1 pl-3 pr-1 text-theme-sm text-accent-700 dark:bg-accent-500/10 dark:text-accent-300"
            >
              {item}
              <button
                type="button"
                onClick={() => onChange(value.filter((other) => other !== item))}
                aria-label={`${item} хасах`}
                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          maxLength={MAX_LENGTH}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(draft);
            }
          }}
          className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-theme-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30"
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
          className="flex h-11 shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Нэмэх
        </button>
      </div>

      {unused.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {unused.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => add(item)}
              className="rounded-full border border-dashed border-gray-300 px-2.5 py-0.5 text-theme-xs text-gray-500 hover:border-accent-400 hover:text-accent-700 dark:border-white/15 dark:text-gray-400"
            >
              + {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
