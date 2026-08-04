"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, RefreshCw } from "lucide-react";

import { auth } from "@/lib/firebase";
import {
  fetchInbox,
  markAllRead,
  markRead,
  type InboxNotification,
} from "@/lib/inbox";

type Filter = "all" | "unread";

const dateFormatter = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function NotificationList() {
  const router = useRouter();
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!auth.currentUser) return;

    setLoading(true);
    setError("");

    try {
      const inbox = await fetchInbox();
      setItems(inbox.notifications);
      setUnread(inbox.unread);
    } catch (err) {
      console.error("Мэдэгдэл татахад алдаа гарлаа:", err);
      setError("Мэдэгдлийг ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkAllRead = async () => {
    const previous = items;
    setItems((prev) =>
      prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date() }))
    );
    setUnread(0);

    try {
      await markAllRead();
    } catch (err) {
      console.error("Уншсан болгоход алдаа гарлаа:", err);
      setItems(previous);
      await load();
    }
  };

  const handleClick = async (item: InboxNotification) => {
    if (!item.readAt) {
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, readAt: new Date() } : row
        )
      );
      setUnread((count) => Math.max(0, count - 1));

      markRead([item.id]).catch((err) => {
        console.error("Уншсан болгоход алдаа гарлаа:", err);
        load();
      });
    }

    if (!item.url) return;

    if (item.url.startsWith("http")) {
      window.open(item.url, "_blank");
    } else {
      router.push(item.url);
    }
  };

  const visible =
    filter === "unread" ? items.filter((item) => !item.readAt) : items;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {([
            { key: "all", name: "Бүгд", count: items.length },
            { key: "unread", name: "Уншаагүй", count: unread },
          ] as const).map((item) => {
            const isActive = item.key === filter;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`rounded-lg px-3 py-2 text-theme-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent-600 text-white"
                    : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400"
                }`}
              >
                {item.name}
                <span
                  className={
                    isActive ? "ml-1.5 text-white/70" : "ml-1.5 text-gray-400"
                  }
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
            >
              <Check className="h-4 w-4" strokeWidth={1.8} />
              Бүгдийг уншсан
            </button>
          )}

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              strokeWidth={1.8}
            />
            Сэргээх
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      <div className="surface divide-y divide-gray-100 dark:divide-white/5">
        {loading && items.length === 0 && (
          <p className="px-5 py-10 text-center text-theme-sm text-gray-500">
            Ачаалж байна...
          </p>
        )}

        {!loading && visible.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <Bell
              className="h-9 w-9 text-gray-300 dark:text-gray-600"
              strokeWidth={1.5}
            />
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              {filter === "unread"
                ? "Уншаагүй мэдэгдэл алга."
                : "Мэдэгдэл байхгүй байна."}
            </p>
          </div>
        )}

        {visible.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleClick(item)}
            className={`flex w-full gap-3.5 px-5 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03] ${
              item.readAt ? "" : "bg-accent-50/40 dark:bg-accent-500/[0.07]"
            }`}
          >
            <span
              className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
                item.readAt ? "bg-transparent" : "bg-accent-600"
              }`}
            />

            <span className="min-w-0 flex-1">
              <span
                className={`block text-theme-sm ${
                  item.readAt
                    ? "text-gray-700 dark:text-gray-300"
                    : "font-semibold text-gray-900 dark:text-white"
                }`}
              >
                {item.title}
              </span>
              {item.body && (
                <span className="mt-1 block text-theme-sm text-gray-500 dark:text-gray-400">
                  {item.body}
                </span>
              )}
              <span className="mt-1.5 block text-theme-xs text-gray-400 dark:text-gray-500">
                {dateFormatter.format(item.createdAt)}
                {item.readAt ? "" : " • уншаагүй"}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
