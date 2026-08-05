"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";

import { genders } from "@/data/profileOptions";
import type { Child } from "@/lib/users";

type ChildrenEditorProps = {
  value: Child[];
  onChange: (children: Child[]) => void;
};

/** Шинэ мөрийн түр id — серверт хадгалагдахад жинхэнэ id-аар солигдоно */
let tempId = 0;
const nextTempId = () => `new-${(tempId += 1)}`;

const emptyChild = (): Child => ({
  id: nextTempId(),
  name: "",
  birthDate: "",
  gender: "",
});

const inputClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 shadow-theme-xs transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

/** Хүүхдийн жагсаалт — нэр, төрсөн огноо, хүйс. Мөр нэмэх/хасах боломжтой. */
export default function ChildrenEditor({
  value,
  onChange,
}: ChildrenEditorProps) {
  const update = (id: string, patch: Partial<Child>) => {
    onChange(
      value.map((child) => (child.id === id ? { ...child, ...patch } : child))
    );
  };

  const remove = (id: string) => {
    onChange(value.filter((child) => child.id !== id));
  };

  return (
    <div className="flex flex-col gap-3">
      {value.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-theme-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
          Хүүхэд бүртгээгүй байна.
        </p>
      )}

      {value.map((child, index) => (
        <div
          key={child.id}
          className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-[1fr_auto] dark:border-white/10"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label
                htmlFor={`child-name-${child.id}`}
                className="mb-1.5 block text-theme-xs font-medium text-gray-600 dark:text-gray-400"
              >
                {index + 1}-р хүүхдийн нэр
              </label>
              <input
                id={`child-name-${child.id}`}
                value={child.name}
                onChange={(event) => update(child.id, { name: event.target.value })}
                placeholder="Нэр"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor={`child-birth-${child.id}`}
                className="mb-1.5 block text-theme-xs font-medium text-gray-600 dark:text-gray-400"
              >
                Төрсөн огноо
              </label>
              <input
                id={`child-birth-${child.id}`}
                type="date"
                value={child.birthDate}
                onChange={(event) =>
                  update(child.id, { birthDate: event.target.value })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor={`child-gender-${child.id}`}
                className="mb-1.5 block text-theme-xs font-medium text-gray-600 dark:text-gray-400"
              >
                Хүйс
              </label>
              <select
                id={`child-gender-${child.id}`}
                value={child.gender}
                onChange={(event) =>
                  update(child.id, { gender: event.target.value })
                }
                className={inputClass}
              >
                <option value="">Сонгоогүй</option>
                {genders.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={() => remove(child.id)}
              aria-label={`${index + 1}-р хүүхдийг хасах`}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 text-error-500 transition-colors hover:bg-error-50 dark:border-white/10 dark:hover:bg-error-500/10"
            >
              <Trash2 className="h-4.5 w-4.5" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      ))}

      <div>
        <button
          type="button"
          onClick={() => onChange([...value, emptyChild()])}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Хүүхэд нэмэх
        </button>
      </div>
    </div>
  );
}
