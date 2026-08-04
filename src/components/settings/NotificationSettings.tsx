"use client";

import React, { useState, useSyncExternalStore } from "react";
import { Bell, BellOff, CheckCircle2, TriangleAlert } from "lucide-react";

import {
  disablePushNotifications,
  enablePushNotifications,
  pushPermission,
} from "@/lib/fcm";

type State = "idle" | "working";

type Status = NotificationPermission | "unsupported" | "unknown";

const statusText: Record<Status, string> = {
  granted: "Мэдэгдэл идэвхтэй",
  denied: "Мэдэгдэл хаагдсан",
  default: "Зөвшөөрөл аваагүй",
  unsupported: "Энэ хөтөч дэмжихгүй",
  unknown: "Шалгаж байна...",
};

/**
 * Notification.permission нь React-ийн гадна байдаг төлөв — хөтчийн
 * тохиргооноос ч өөрчлөгдөнө. Тиймээс useState биш, гадаад эх сурвалж болгож
 * уншина (SSR үед Notification API байхгүй тул "unknown").
 */
let listeners: Array<() => void> = [];

const notifyPermissionChanged = () => listeners.forEach((listener) => listener());

const subscribePermission = (onChange: () => void) => {
  listeners.push(onChange);

  // Хөтчийн тохиргооноос зөвшөөрөл өөрчилөөд буцаж ирэхэд шинэчилнэ
  document.addEventListener("visibilitychange", onChange);

  return () => {
    listeners = listeners.filter((listener) => listener !== onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
};

export default function NotificationSettings() {
  const status = useSyncExternalStore(
    subscribePermission,
    () => pushPermission() as Status,
    () => "unknown" as Status
  );

  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const refresh = notifyPermissionChanged;

  const handleEnable = async () => {
    setState("working");
    setError(null);
    setDetail(null);

    const result = await enablePushNotifications();

    if (!result.ok) {
      setError(result.reason);
      setDetail(result.detail ?? null);
    }

    refresh();
    setState("idle");
  };

  const handleDisable = async () => {
    setState("working");
    setError(null);
    setDetail(null);

    try {
      await disablePushNotifications();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Унтраахад алдаа гарлаа."
      );
    }

    refresh();
    setState("idle");
  };

  const isGranted = status === "granted";
  const isDenied = status === "denied";
  const isUnsupported = status === "unsupported";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-medium text-gray-800 dark:text-white/90">
          Push мэдэгдэл
        </h2>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Хог тээвэрлэлт, зарлагын баталгаажуулалт зэрэг мэдэгдлийг апп хаалттай
          үед ч хүлээн авна.
        </p>
      </div>

      {/* Одоогийн төлөв */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-accent-50/70 p-4 dark:bg-white/[0.04]">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isGranted
              ? "bg-success-500/15 text-success-600 dark:text-success-400"
              : "bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-gray-400"
          }`}
        >
          {isGranted ? (
            <Bell className="h-5 w-5" strokeWidth={1.8} />
          ) : (
            <BellOff className="h-5 w-5" strokeWidth={1.8} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 dark:text-white">
            {statusText[status]}
          </p>
          <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
            {isGranted
              ? "Энэ төхөөрөмж мэдэгдэл хүлээн авахад бүртгэгдсэн."
              : isDenied
                ? "Хөтөчийн тохиргооноос гараар нээх шаардлагатай."
                : "Товч дарж зөвшөөрөл олгоно уу."}
          </p>
        </div>

        {!isUnsupported &&
          (isGranted ? (
            <button
              type="button"
              onClick={handleDisable}
              disabled={state === "working"}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
            >
              {state === "working" ? "Түр хүлээнэ үү..." : "Унтраах"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnable}
              disabled={state === "working" || isDenied}
              className="rounded-lg bg-accent-600 px-4 py-2 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === "working" ? "Түр хүлээнэ үү..." : "Мэдэгдэл зөвшөөрөх"}
            </button>
          ))}
      </div>

      {/* Хөтөч дээр хаасан бол товч тусламж болохгүй — гараар нээх зааварчилгаа */}
      {isDenied && (
        <div className="flex gap-3 rounded-lg bg-warning-50 px-4 py-3 dark:bg-warning-500/10">
          <TriangleAlert
            className="h-4.5 w-4.5 shrink-0 text-warning-600 dark:text-warning-400"
            strokeWidth={1.8}
          />
          <div className="text-theme-sm text-warning-700 dark:text-warning-400">
            <p className="font-medium">Хөтөч дээр хаагдсан байна</p>
            <p className="mt-1">
              Хаягийн мөрний зүүн талын түгжээ (эсвэл ⓘ) дүрс дээр дарж →
              Мэдэгдэл → Зөвшөөрөх болгоод хуудсыг сэргээнэ үү.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-error-50 px-4 py-3 dark:bg-error-500/10">
          <p className="text-theme-sm text-error-600 dark:text-error-400">
            {error}
          </p>
          {detail && (
            <p className="mt-1 break-all text-theme-xs text-error-500/80">
              {detail}
            </p>
          )}
        </div>
      )}

      {isGranted && !error && (
        <p className="flex items-center gap-2 text-theme-sm text-success-600 dark:text-success-400">
          <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
          Token сервер дээр хадгалагдсан — админ мэдэгдэл илгээхэд хүрнэ.
        </p>
      )}
    </div>
  );
}
