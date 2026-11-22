"use client";

import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";

import type { ScheduleItem, TaskUpdate } from "@/lib/taskProgress";

const WEEKDAYS = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];

const pad = (value: number) => String(value).padStart(2, "0");
const keyOf = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

type ProgressCalendarProps = {
  items: ScheduleItem[];
  updates: TaskUpdate[];
  /** Даалгаврын эцсийн хугацаа — YYYY-MM-DD эсвэл хоосон */
  dueDate: string;
  /** Өдөр дээрх явцыг дарахад Явц таб руу шилжинэ */
  onOpenUpdate: (update: TaskUpdate) => void;
};

/**
 * Сар тутмын календарь — хуваарийн үе шатууд (эхлэхээс дуусах хүртэл),
 * тухайн өдрийн явцын мэдээлэл, эцсийн хугацааг нэг дор харуулна.
 */
export default function ProgressCalendar({ items, updates, dueDate, onOpenUpdate }: ProgressCalendarProps) {
  const [cursor, setCursor] = useState(() => {
    // Хамгийн ойрын үйл явдлын сараас эхэлнэ — үгүй бол өнөөдрийн сар
    const first = items[0]?.startDate || dueDate || "";
    const now = new Date();
    return first
      ? { year: Number(first.slice(0, 4)), month: Number(first.slice(5, 7)) - 1 }
      : { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selected, setSelected] = useState<string | null>(null);

  const today = useMemo(() => {
    const now = new Date();
    return keyOf(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const lead = (first.getDay() + 6) % 7; // Даваа гарагаас эхэлнэ
    const days = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const list: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= days; day += 1) list.push(keyOf(cursor.year, cursor.month, day));
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [cursor]);

  const itemsOn = (day: string) => items.filter((item) => item.startDate <= day && day <= (item.endDate || item.startDate));
  const updatesOn = (day: string) => updates.filter((update) => update.period === day);

  const shift = (step: number) => {
    setSelected(null);
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month + step, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const selectedItems = selected ? itemsOn(selected) : [];
  const selectedUpdates = selected ? updatesOn(selected) : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Өмнөх сар"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        <p className="flex-1 text-center text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          {cursor.year}-{pad(cursor.month + 1)}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Дараагийн сар"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-400">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) return <span key={`blank-${index}`} />;
          const dayItems = itemsOn(day);
          const dayUpdates = updatesOn(day);
          const isDue = day === dueDate;
          const active = selected === day;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelected(active ? null : day)}
              className={`flex min-h-[64px] flex-col gap-0.5 rounded-lg border p-1 text-left transition-colors ${
                active
                  ? "border-accent-500 bg-accent-50/60 dark:bg-accent-500/10"
                  : "border-gray-100 hover:border-accent-300 dark:border-white/5"
              }`}
            >
              <span
                className={`flex items-center gap-1 text-[11px] font-medium ${
                  day === today ? "text-accent-600 dark:text-accent-400" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {Number(day.slice(8))}
                {isDue && <Flag className="h-3 w-3 text-error-500" strokeWidth={2.2} />}
              </span>
              {dayItems.slice(0, 2).map((item) => (
                <span
                  key={item.id}
                  className={`truncate rounded px-1 text-[10px] leading-4 ${
                    item.done
                      ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400"
                      : "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                  }`}
                >
                  {item.title}
                </span>
              ))}
              {dayItems.length > 2 && <span className="text-[10px] text-gray-400">+{dayItems.length - 2}</span>}
              {dayUpdates.length > 0 && (
                <span className="mt-auto flex items-center gap-1 text-[10px] text-warning-600 dark:text-warning-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning-500" />
                  {dayUpdates.length} явц
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded bg-accent-100 dark:bg-accent-500/30" /> Хуваарь
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded bg-success-100 dark:bg-success-500/30" /> Хийгдсэн
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-warning-500" /> Явцын мэдээлэл
        </span>
        <span className="flex items-center gap-1">
          <Flag className="h-3 w-3 text-error-500" strokeWidth={2.2} /> Эцсийн хугацаа
        </span>
      </div>

      {selected && (
        <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
          <p className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">{selected}</p>
          {selected === dueDate && (
            <p className="mt-1 text-theme-xs font-medium text-error-600 dark:text-error-400">Эцсийн хугацаа</p>
          )}
          {selectedItems.length === 0 && selectedUpdates.length === 0 && selected !== dueDate && (
            <p className="mt-1 text-theme-xs text-gray-400">Энэ өдөр юу ч алга.</p>
          )}
          {selectedItems.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {selectedItems.map((item) => (
                <li key={item.id} className="text-theme-sm text-gray-700 dark:text-gray-300">
                  {item.done ? "✓ " : "• "}
                  {item.title}
                  <span className="ml-1 text-theme-xs text-gray-400">
                    {item.endDate !== item.startDate ? `${item.startDate} — ${item.endDate}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {selectedUpdates.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {selectedUpdates.map((update) => (
                <li key={update.id}>
                  <button
                    type="button"
                    onClick={() => onOpenUpdate(update)}
                    className="w-full truncate text-left text-theme-sm text-warning-700 hover:underline dark:text-warning-400"
                  >
                    {update.authorName}: {update.poll ? `📊 ${update.poll.question}` : update.body || "Зураг, файл"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
