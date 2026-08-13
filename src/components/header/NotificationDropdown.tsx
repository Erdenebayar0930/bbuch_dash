"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import { Dropdown } from "../ui/dropdown/Dropdown";
import { auth } from "@/lib/firebase";
import {
  fetchInbox,
  markAllRead,
  markRead,
  type InboxNotification,
} from "@/lib/inbox";
import { setupForegroundNotifications } from "@/lib/notifications";

const dateFormatter = new Intl.DateTimeFormat("mn-MN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function NotificationDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  /** Серверээс мэдэгдлүүдийг татна — жинхэнэ эх сурвалж нь DB */
  const load = useCallback(async () => {
    if (!auth.currentUser) return;

    setLoading(true);

    try {
      const inbox = await fetchInbox();
      setItems(inbox.notifications);
      setUnread(inbox.unread);
    } catch (error) {
      console.error("Мэдэгдэл татахад алдаа гарлаа:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Push ирвэл жагсаалтыг шинэчилнэ (мөр нь серверт аль хэдийн үүссэн)
    const unsubscribe = setupForegroundNotifications(() => {
      load();
    });

    // Апп нээлттэй байхад бусад төхөөрөмжөөс ирсэн мэдэгдлийг барина
    const timer = window.setInterval(load, 60_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);

    load();

    return () => {
      // Цуцлахгүй бол effect дахин ажиллах бүрт сонсогч давхарлана
      unsubscribe();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const openDropdown = async () => {
    const wasOpen = isOpen;
    setIsOpen(!wasOpen);

    if (wasOpen) return;

    // Нээхэд шинэчилж, дэлгэцэнд гарсан мэдэгдлүүдийг уншсан болгоно
    await load();
  };

  const handleMarkAllRead = async () => {
    const previous = items;

    // Хариу ирэхээс өмнө дэлгэцийг шинэчилж, алдаа гарвал буцаана
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date() })));
    setUnread(0);

    try {
      await markAllRead();
    } catch (error) {
      console.error("Уншсан болгоход алдаа гарлаа:", error);
      setItems(previous);
      await load();
    }
  };

  const handleItemClick = async (item: InboxNotification) => {
    setIsOpen(false);

    if (!item.readAt) {
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, readAt: new Date() } : row))
      );
      setUnread((count) => Math.max(0, count - 1));

      markRead([item.id]).catch((error) => {
        console.error("Уншсан болгоход алдаа гарлаа:", error);
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

  return (
    <div className="relative">
      <button
        onClick={openDropdown}
        aria-label={unread > 0 ? `${unread} уншаагүй мэдэгдэл` : "Мэдэгдэл"}
        className="dropdown-toggle relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
      >
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
        <Bell className="h-5 w-5" strokeWidth={1.8} />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="absolute right-0 mt-4 flex max-h-[480px] w-[340px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-white/10 dark:bg-gray-900 sm:w-[380px]"
      >
        <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-2.5 dark:border-white/10">
          <h5 className="font-semibold text-gray-800 dark:text-white/90">
            Мэдэгдэл
            {unread > 0 && (
              <span className="ml-2 text-theme-xs font-normal text-gray-500 dark:text-gray-400">
                {unread} уншаагүй
              </span>
            )}
          </h5>

          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-theme-xs font-medium text-accent-600 hover:underline dark:text-accent-400"
            >
              Бүгдийг уншсан
            </button>
          )}
        </div>

        <ul className="custom-scrollbar flex flex-col overflow-y-auto">
          {loading && items.length === 0 ? (
            <li className="py-10 text-center text-theme-sm text-gray-500 dark:text-gray-400">
              Ачаалж байна...
            </li>
          ) : items.length === 0 ? (
            <li className="flex flex-col items-center gap-2 py-10 text-center">
              <Bell
                className="h-8 w-8 text-gray-300 dark:text-gray-600"
                strokeWidth={1.5}
              />
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                Мэдэгдэл байхгүй
              </p>
            </li>
          ) : (
            items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className={`flex w-full gap-3 rounded-lg border-b border-gray-100 p-3 text-left transition-colors hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5 ${
                    item.readAt ? "" : "bg-accent-50/50 dark:bg-accent-500/10"
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      item.readAt ? "bg-transparent" : "bg-accent-600"
                    }`}
                  />

                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-theme-sm ${
                        item.readAt
                          ? "text-gray-600 dark:text-gray-400"
                          : "font-semibold text-gray-900 dark:text-white"
                      }`}
                    >
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
                      {item.body}
                    </span>
                    <span className="mt-1 block text-theme-xs text-gray-400 dark:text-gray-500">
                      {dateFormatter.format(item.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>

        <Link
          href="/notifications"
          onClick={() => setIsOpen(false)}
          className="mt-2 block rounded-lg border border-gray-200 px-4 py-2 text-center text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
        >
          Бүх мэдэгдэл
        </Link>
      </Dropdown>
    </div>
  );
}
