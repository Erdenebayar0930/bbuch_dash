"use client";

import { apiFetch } from "./apiClient";
import { getDeviceId } from "./deviceId";

export type Device = {
  id: string;
  deviceId: string;
  label: string;
  active: boolean;
  lastSeenAt: string | null;
  createdAt: string | null;
};

/** Өөрийн нэвтэрсэн төхөөрөмжүүд. */
export async function listDevices(): Promise<Device[]> {
  const data = await apiFetch<{ devices: Device[] }>("/api/devices");
  return data.devices;
}

/** Одоо ашиглаж буй хөтчийн танигч — жагсаалтад тэмдэглэхэд хэрэглэнэ. */
export { getDeviceId as currentDeviceId };

/** Төхөөрөмжийг идэвхтэй/идэвхгүй болгоно. */
export async function setDeviceActive(id: string, active: boolean) {
  await apiFetch(`/api/devices/${id}`, { method: "PATCH", body: { active } });
}

/** Төхөөрөмжийн бүртгэлийг устгана. */
export async function removeDevice(id: string) {
  await apiFetch(`/api/devices/${id}`, { method: "DELETE" });
}
