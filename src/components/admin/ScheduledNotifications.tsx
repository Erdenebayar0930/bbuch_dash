"use client";

import { CalendarClock, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useUser } from "@/app/(auth)/UserProvider";
import Checkbox from "@/components/form/input/Checkbox";
import { aimags as aimagOptions, labelOf } from "@/data/profileOptions";
import { isAdminRole } from "@/lib/permissions";
import {
  createScheduledNotification,
  deleteScheduledNotification,
  listScheduledNotifications,
  setScheduledNotificationActive,
  type ScheduledNotification,
  type ScheduleFrequency,
} from "@/lib/scheduledNotifications";

import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";

const weekdayLabels = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];

const frequencyLabels: Record<ScheduleFrequency, string> = {
  daily: "Өдөр бүр",
  weekly: "7 хоног бүр",
  monthly: "Сар бүр",
};

function describeTarget(schedule: ScheduledNotification): string {
  if (schedule.targetType === "all") return "Бүх идэвхтэй хэрэглэгчид";
  if (schedule.targetType === "aimag") {
    return schedule.targetValues.map((value) => labelOf(aimagOptions, value)).join(", ");
  }
  return schedule.targetValues[0] ?? "";
}

function describeSchedule(schedule: ScheduledNotification): string {
  if (schedule.frequency === "weekly") {
    return `${weekdayLabels[schedule.dayOfWeek] ?? "?"} гарагт, ${schedule.timeOfDay}`;
  }
  if (schedule.frequency === "monthly") {
    return `Сар бүрийн ${schedule.dayOfMonth}-нд, ${schedule.timeOfDay}`;
  }
  return `Өдөр бүр ${schedule.timeOfDay}`;
}

/** Тогтмол (давтагддаг) мэдэгдэл — жишээ нь "7 хоног бүр Ням гарагт сануулга". */
export default function ScheduledNotifications() {
  const { user: viewer } = useUser();
  const isAdmin = isAdminRole(viewer?.role);

  const [schedules, setSchedules] = useState<ScheduledNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [frequency, setFrequency] = useState<ScheduleFrequency>("daily");
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [targetType, setTargetType] = useState<"all" | "aimag">("aimag");
  const [selectedAimags, setSelectedAimags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setSchedules(await listScheduledNotifications());
    } catch (err) {
      console.error("Тогтмол мэдэгдэл ачаалж чадсангүй:", err);
      setError("Жагсаалтыг ачаалж чадсангүй.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (viewer && !isAdmin && targetType === "all") setTargetType("aimag");
  }, [viewer, isAdmin, targetType]);

  const toggleActive = async (schedule: ScheduledNotification) => {
    setBusyId(schedule.id);
    try {
      await setScheduledNotificationActive(schedule.id, !schedule.active);
      setSchedules((prev) =>
        prev.map((s) => (s.id === schedule.id ? { ...s, active: !s.active } : s))
      );
    } catch (err) {
      console.error("Идэвх солиход алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Идэвх солиход алдаа гарлаа.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (schedule: ScheduledNotification) => {
    if (!window.confirm(`«${schedule.title}» тогтмол мэдэгдлийг устгах уу?`)) return;

    setBusyId(schedule.id);
    try {
      await deleteScheduledNotification(schedule.id);
      setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
    } catch (err) {
      console.error("Устгахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleAimag = (value: string, checked: boolean) => {
    setSelectedAimags((prev) =>
      checked ? [...prev, value] : prev.filter((item) => item !== value)
    );
  };

  const resetForm = () => {
    setTitle("");
    setBody("");
    setFrequency("daily");
    setTimeOfDay("09:00");
    setDayOfWeek(0);
    setDayOfMonth(1);
    setSelectedAimags([]);
    setFormError("");
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim() || !body.trim()) {
      setFormError("Гарчиг болон агуулгыг бөглөнө үү.");
      return;
    }
    if (targetType === "aimag" && selectedAimags.length === 0) {
      setFormError("Дор хаяж нэг аймаг сонгоно уу.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const created = await createScheduledNotification({
        title: title.trim(),
        body: body.trim(),
        targetType,
        targetValues: targetType === "aimag" ? selectedAimags : undefined,
        frequency,
        timeOfDay,
        dayOfWeek: frequency === "weekly" ? dayOfWeek : undefined,
        dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined,
      });

      setSchedules((prev) => [created, ...prev]);
      resetForm();
      setShowForm(false);
    } catch (err) {
      console.error("Тогтмол мэдэгдэл үүсгэхэд алдаа гарлаа:", err);
      setFormError(err instanceof Error ? err.message : "Үүсгэхэд алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  const targetOptions = useMemo(
    () => (isAdmin ? (["all", "aimag"] as const) : (["aimag"] as const)),
    [isAdmin]
  );

  return (
    <div className="p-5 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-brand-500" />
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Тогтмол мэдэгдэл
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowForm((prev) => !prev)}
          >
            <Plus className="h-4 w-4" />
            Шинэ тогтмол мэдэгдэл
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-5 flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.03]"
        >
          <div>
            <Label>
              Гарчиг <span className="text-error-500">*</span>
            </Label>
            <Input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Жишээ нь: Ням гарагийн сануулга"
            />
          </div>

          <div>
            <Label>
              Агуулга <span className="text-error-500">*</span>
            </Label>
            <textarea
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
              rows={3}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Давтамж</Label>
              <select
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as ScheduleFrequency)}
                className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
              >
                {(Object.keys(frequencyLabels) as ScheduleFrequency[]).map((key) => (
                  <option key={key} value={key}>
                    {frequencyLabels[key]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Цаг</Label>
              <Input
                type="time"
                value={timeOfDay}
                onChange={(event) => setTimeOfDay(event.target.value)}
              />
            </div>

            {frequency === "weekly" && (
              <div>
                <Label>Гараг</Label>
                <select
                  value={dayOfWeek}
                  onChange={(event) => setDayOfWeek(Number(event.target.value))}
                  className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
                >
                  {weekdayLabels.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {frequency === "monthly" && (
              <div>
                <Label>Сарын хэд</Label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  value={dayOfMonth}
                  onChange={(event) => setDayOfMonth(Number(event.target.value))}
                />
              </div>
            )}

            <div>
              <Label>Хүлээн авагч</Label>
              <select
                value={targetType}
                onChange={(event) => setTargetType(event.target.value as "all" | "aimag")}
                className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
              >
                {targetOptions.map((value) => (
                  <option key={value} value={value}>
                    {value === "all" ? "Бүх хэрэглэгчид" : "Аймаг"}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {targetType === "aimag" && (
            <div>
              <Label>Аймаг (хэд хэдийг зэрэг сонгож болно)</Label>
              <div className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-2 dark:border-gray-800">
                {aimagOptions.map((option) => (
                  <Checkbox
                    key={option.value}
                    id={`schedule-aimag-${option.value}`}
                    label={option.label}
                    checked={selectedAimags.includes(option.value)}
                    onChange={(checked) => toggleAimag(option.value, checked)}
                  />
                ))}
              </div>
            </div>
          )}

          {formError && (
            <p className="text-sm text-error-600 dark:text-error-400">{formError}</p>
          )}

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Хадгалж байна...
                </>
              ) : (
                "Үүсгэх"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Цуцлах
            </Button>
          </div>
        </form>
      )}

      {loading && schedules.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Ачаалж байна...</p>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Тогтмол мэдэгдэл тохируулаагүй байна.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {schedules.map((schedule) => (
            <li
              key={schedule.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                  {schedule.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {describeSchedule(schedule)} · {describeTarget(schedule)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={busyId === schedule.id}
                  onClick={() => toggleActive(schedule)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                    schedule.active
                      ? "bg-success-50 text-success-700 hover:bg-success-100 dark:bg-success-500/15 dark:text-success-400"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400"
                  }`}
                >
                  {schedule.active ? "Идэвхтэй" : "Идэвхгүй"}
                </button>
                <button
                  type="button"
                  disabled={busyId === schedule.id}
                  onClick={() => remove(schedule)}
                  aria-label={`«${schedule.title}» устгах`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-error-500 transition-colors hover:bg-error-50 disabled:opacity-50 dark:hover:bg-error-500/10"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
