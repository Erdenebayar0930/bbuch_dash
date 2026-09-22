"use client";

import { apiFetch } from "./apiClient";

export type ScheduleFrequency = "daily" | "weekly" | "monthly";
export type ScheduleTargetType = "all" | "aimag" | "role";

export type ScheduledNotification = {
  id: string;
  title: string;
  body: string;
  url: string;
  targetType: ScheduleTargetType;
  /** targetType нь "aimag" үед хэд хэдэн утгатай байж болно */
  targetValues: string[];
  frequency: ScheduleFrequency;
  timeOfDay: string;
  dayOfWeek: number;
  dayOfMonth: number;
  active: boolean;
  lastSentDate: string;
  createdBy: string | null;
};

type Row = {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  targetType: string;
  targetValues: string[] | null;
  frequency: string;
  timeOfDay: string;
  dayOfWeek: number;
  dayOfMonth: number;
  active: boolean | number;
  lastSentDate: string | null;
  createdBy: string | null;
};

function toSchedule(row: Row): ScheduledNotification {
  return {
    id: row.id,
    title: row.title,
    body: row.body ?? "",
    url: row.url ?? "",
    targetType: (row.targetType as ScheduleTargetType) ?? "all",
    targetValues: Array.isArray(row.targetValues) ? row.targetValues : [],
    frequency: (row.frequency as ScheduleFrequency) ?? "daily",
    timeOfDay: row.timeOfDay ?? "09:00",
    dayOfWeek: row.dayOfWeek ?? -1,
    dayOfMonth: row.dayOfMonth ?? -1,
    active: !!row.active,
    lastSentDate: row.lastSentDate ?? "",
    createdBy: row.createdBy,
  };
}

/** Тогтмол мэдэгдлийн жагсаалт (мэдэгдэл илгээх эрхтэй хэн ч уншина). */
export async function listScheduledNotifications(): Promise<ScheduledNotification[]> {
  const data = await apiFetch<{ schedules: Row[] }>("/api/notifications/scheduled");
  return (data.schedules ?? []).map(toSchedule);
}

export type CreateScheduleInput = {
  title: string;
  body: string;
  url?: string;
  targetType: ScheduleTargetType;
  targetValues?: string[];
  frequency: ScheduleFrequency;
  timeOfDay: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
};

export async function createScheduledNotification(
  input: CreateScheduleInput
): Promise<ScheduledNotification> {
  const data = await apiFetch<{ schedule: Row }>("/api/notifications/scheduled", {
    method: "POST",
    body: input,
  });
  return toSchedule(data.schedule);
}

export async function setScheduledNotificationActive(id: string, active: boolean) {
  await apiFetch(`/api/notifications/scheduled/${id}`, {
    method: "PATCH",
    body: { active },
  });
}

export async function deleteScheduledNotification(id: string) {
  await apiFetch(`/api/notifications/scheduled/${id}`, { method: "DELETE" });
}
