"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";

import { taskStatusLabels, type TaskStatus } from "@/data/taskOptions";
import type { Task } from "@/lib/tasks";
import { listScheduleRange, type WeekScheduleItem } from "@/lib/taskProgress";

const WEEKDAYS = ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба", "Ням"];

const pad = (value: number) => String(value).padStart(2, "0");
const iso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Тухайн өдрийн 7 хоногийн даваа гараг */
function mondayOf(date: Date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

const statusDot: Record<TaskStatus, string> = {
  todo: "bg-gray-400",
  in_progress: "bg-accent-500",
  done: "bg-success-500",
};

type WeekCalendarProps = {
  /** Самбар дээр харагдаж буй төлөвлөгөөнүүд — шүүлт нь самбартай ижил */
  tasks: Task[];
  /** Төлөвлөгөө дээр дарахад — самбарын адил засах/явцын цонх нээнэ */
  onOpenTask: (task: Task) => void;
};

/**
 * Төлөвлөгөөний 7 хоногийн календарь — өдөр бүрт тухайн өдөр эцсийн хугацаатай
 * төлөвлөгөө, үргэлжилж буй хуваарийн үе шатуудыг харуулна. Өмнөх/дараагийн
 * 7 хоног руу шилжинэ.
 */
export default function WeekCalendar({ tasks, onOpenTask }: WeekCalendarProps) {
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [items, setItems] = useState<WeekScheduleItem[]>([]);
  const [error, setError] = useState("");

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const day = new Date(monday);
        day.setDate(monday.getDate() + index);
        return iso(day);
      }),
    [monday]
  );
  const from = days[0];
  const to = days[6];
  const today = iso(new Date());

  useEffect(() => {
    let cancelled = false;
    listScheduleRange(from, to)
      .then((rows) => {
        if (!cancelled) {
          setItems(rows);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Хуваарь ачаалахад алдаа гарлаа.");
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const byId = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const shift = (weeks: number) =>
    setMonday((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + weeks * 7);
      return next;
    });

  // Энэ 7 хоногт хамаатай төлөвлөгөөний тоо — эцсийн хугацаа эсвэл үе шат
  const weekTaskIds = new Set([
    ...tasks.filter((task) => task.dueDate >= from && task.dueDate <= to).map((task) => task.id),
    ...items.filter((item) => byId.has(item.taskId)).map((item) => item.taskId),
  ]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Өмнөх 7 хоног"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        <p className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          {from} — {to}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Дараагийн 7 хоног"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
        {!(today >= from && today <= to) && (
          <button
            type="button"
            onClick={() => setMonday(mondayOf(new Date()))}
            className="h-9 rounded-lg border border-gray-200 px-3 text-theme-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
          >
            Энэ 7 хоног
          </button>
        )}
        <span className="ml-auto text-theme-xs text-gray-500 dark:text-gray-400">
          {weekTaskIds.size} төлөвлөгөөт ажил
        </span>
      </div>

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-2.5 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      <div className="grid gap-2 md:grid-cols-7">
        {days.map((day, index) => {
          const due = tasks.filter((task) => task.dueDate === day);
          const running = items.filter(
            (item) => byId.has(item.taskId) && item.startDate <= day && day <= item.endDate
          );
          const isToday = day === today;
          return (
            <section
              key={day}
              className={`surface flex min-h-[140px] flex-col gap-1.5 p-2.5 ${
                isToday ? "ring-2 ring-accent-500" : ""
              }`}
            >
              <header className="flex items-baseline justify-between gap-1">
                <span
                  className={`text-theme-xs font-semibold ${
                    isToday ? "text-accent-600 dark:text-accent-400" : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {WEEKDAYS[index]}
                </span>
                <span className="text-[11px] text-gray-400">{day.slice(5)}</span>
              </header>

              {due.length === 0 && running.length === 0 && (
                <p className="text-[11px] text-gray-300 dark:text-gray-600">—</p>
              )}

              {due.map((task) => (
                <button
                  key={`due-${task.id}`}
                  type="button"
                  onClick={() => onOpenTask(task)}
                  title={`${taskStatusLabels[task.status]} · эцсийн хугацаа`}
                  className="flex items-start gap-1.5 rounded-md border border-error-200 bg-error-50/60 px-1.5 py-1 text-left text-[12px] leading-4 text-gray-800 hover:border-error-400 dark:border-error-500/30 dark:bg-error-500/10 dark:text-white/90"
                >
                  <Flag className="mt-0.5 h-3 w-3 shrink-0 text-error-500" strokeWidth={2.2} />
                  <span className={task.status === "done" ? "line-through opacity-60" : ""}>{task.title}</span>
                </button>
              ))}

              {running.map((item) => {
                const task = byId.get(item.taskId);
                if (!task) return null;
                return (
                  <button
                    key={`item-${item.id}-${day}`}
                    type="button"
                    onClick={() => onOpenTask(task)}
                    title={`${task.title} · ${item.startDate}${item.endDate !== item.startDate ? ` — ${item.endDate}` : ""}`}
                    className={`flex flex-col rounded-md px-1.5 py-1 text-left text-[12px] leading-4 ${
                      item.done
                        ? "bg-success-50 text-success-800 dark:bg-success-500/15 dark:text-success-300"
                        : "bg-accent-50 text-accent-800 hover:bg-accent-100 dark:bg-accent-500/15 dark:text-accent-200"
                    }`}
                  >
                    <span className={item.done ? "line-through opacity-70" : "font-medium"}>{item.title}</span>
                    <span className="flex items-center gap-1 text-[10px] opacity-70">
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot[task.status]}`} />
                      {task.title}
                    </span>
                  </button>
                );
              })}
            </section>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <Flag className="h-3 w-3 text-error-500" strokeWidth={2.2} /> Эцсийн хугацаа
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded bg-accent-100 dark:bg-accent-500/30" /> Хуваарийн үе шат
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded bg-success-100 dark:bg-success-500/30" /> Хийгдсэн
        </span>
      </div>
    </div>
  );
}
