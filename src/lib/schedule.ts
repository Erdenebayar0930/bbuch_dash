"use client";

import { apiFetch } from "./apiClient";

type ScheduleResponse = { imageUrl: string };

export async function getSchedulePosterUrl(): Promise<string> {
  const data = await apiFetch<ScheduleResponse>("/api/schedule");
  return data.imageUrl;
}

export async function saveSchedulePosterUrl(imageUrl: string): Promise<string> {
  const data = await apiFetch<ScheduleResponse>("/api/schedule", {
    method: "PUT",
    body: { imageUrl },
  });
  return data.imageUrl;
}
