"use client";

import React, { useEffect, useState } from "react";
import { Laptop, Trash2 } from "lucide-react";

import Switch from "@/components/form/switch/Switch";
import {
  currentDeviceId,
  listDevices,
  removeDevice,
  setDeviceActive,
  type Device,
} from "@/lib/devices";

const dateFormatter = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default function SecuritySettings() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      setDevices(await listDevices());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ачаалахад алдаа гарлаа.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggle = async (device: Device, active: boolean) => {
    setBusyId(device.id);
    try {
      await setDeviceActive(device.id, active);
      setDevices(
        (prev) =>
          prev?.map((d) => (d.id === device.id ? { ...d, active } : d)) ?? null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Өөрчлөхөд алдаа гарлаа.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (device: Device) => {
    setBusyId(device.id);
    try {
      await removeDevice(device.id);
      setDevices((prev) => prev?.filter((d) => d.id !== device.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    } finally {
      setBusyId(null);
    }
  };

  const thisDeviceId = currentDeviceId();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-medium text-gray-800 dark:text-white/90">
          Нэвтэрсэн төхөөрөмжүүд
        </h2>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Танигдахгүй төхөөрөмж харагдвал идэвхгүй болгоно уу — тэр даруй
          дараагийн хүсэлт дээрээ гарна.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </div>
      )}

      {devices === null && !error ? (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Ачаалж байна...
        </p>
      ) : devices && devices.length === 0 ? (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Бүртгэгдсэн төхөөрөмж алга.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-white/10">
          {devices?.map((device) => {
            const isThisDevice = device.deviceId === thisDeviceId;
            const busy = busyId === device.id;

            return (
              <li
                key={device.id}
                className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    device.active
                      ? "bg-success-500/15 text-success-600 dark:text-success-400"
                      : "bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-gray-400"
                  }`}
                >
                  <Laptop className="h-5 w-5" strokeWidth={1.8} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                    {device.label || "Тодорхойгүй төхөөрөмж"}
                    {isThisDevice && (
                      <span className="rounded-full bg-accent-50 px-2 py-0.5 text-theme-xs font-medium text-accent-700 dark:bg-accent-500/15 dark:text-accent-300">
                        Энэ төхөөрөмж
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                    Сүүлд идэвхтэй байсан:{" "}
                    {device.lastSeenAt
                      ? dateFormatter.format(new Date(device.lastSeenAt))
                      : "—"}
                  </p>
                </div>

                <Switch
                  key={`${device.id}-${device.active}`}
                  label={device.active ? "Идэвхтэй" : "Идэвхгүй"}
                  defaultChecked={device.active}
                  disabled={busy}
                  onChange={(checked) => handleToggle(device, checked)}
                />

                <button
                  type="button"
                  onClick={() => handleRemove(device)}
                  disabled={busy}
                  title="Бүртгэлээс устгах"
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-error-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/5"
                >
                  <Trash2 className="h-4.5 w-4.5" strokeWidth={1.8} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
