"use client";

import { apiFetch } from "./apiClient";

/** Аппын мэдэгдлийн жагсаалт — push-аас хамааралгүй, DB-д хадгалагдсан бүртгэл */
export type InboxNotification = {
  id: string;
  title: string;
  body: string;
  /** Дарахад шилжих зам — хоосон бол шилжихгүй */
  url: string;
  /** null бол уншаагүй */
  readAt: Date | null;
  createdAt: Date;
};

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  url: string;
  readAt: string | null;
  createdAt: string;
};

const toNotification = (row: NotificationRow): InboxNotification => ({
  id: row.id,
  title: row.title,
  body: row.body ?? "",
  url: row.url ?? "",
  readAt: row.readAt ? new Date(row.readAt) : null,
  createdAt: new Date(row.createdAt),
});

export type Inbox = {
  notifications: InboxNotification[];
  unread: number;
};

/** Өөрийн мэдэгдлүүдийг татна. */
export async function fetchInbox(): Promise<Inbox> {
  const data = await apiFetch<{
    notifications: NotificationRow[];
    unread: number;
  }>("/api/notifications");

  return {
    notifications: (data.notifications ?? []).map(toNotification),
    unread: data.unread ?? 0,
  };
}

/** Сонгосон мэдэгдлүүдийг уншсан болгоно. */
export async function markRead(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;

  const data = await apiFetch<{ updated: number }>("/api/notifications", {
    method: "PATCH",
    body: { ids },
  });

  return data.updated ?? 0;
}

/** Бүх уншаагүй мэдэгдлийг уншсан болгоно. */
export async function markAllRead(): Promise<number> {
  const data = await apiFetch<{ updated: number }>("/api/notifications", {
    method: "PATCH",
    body: { all: true },
  });

  return data.updated ?? 0;
}
