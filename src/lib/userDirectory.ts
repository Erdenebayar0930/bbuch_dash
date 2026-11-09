"use client";

import { apiFetch } from "./apiClient";
import { toAppUser, type AppUser, type UserRow } from "./users";

/** Тайланд харагдах хүүхэд */
export type DirectoryChild = {
  name: string;
  /** YYYY-MM-DD, эсвэл хоосон */
  birthDate: string;
  /** male | female | "" */
  gender: string;
};

/** Жагсаалтын мөр — профайл ба хүүхдүүд */
export type DirectoryUser = AppUser & { children: DirectoryChild[] };

type ChildRow = {
  name: string | null;
  birthDate: string | null;
  gender: string | null;
};

const toChild = (row: ChildRow): DirectoryChild => ({
  name: row.name ?? "",
  birthDate: row.birthDate ?? "",
  gender: row.gender ?? "",
});

/** Бүх хэрэглэгчийн дэлгэрэнгүй мэдээлэл (зөвхөн админ). */
export async function listDirectory(): Promise<DirectoryUser[]> {
  const data = await apiFetch<{
    users: (UserRow & { children?: ChildRow[] })[];
  }>("/api/users/directory");

  return (data.users ?? []).map((row) => ({
    ...toAppUser(row),
    children: (row.children ?? []).map(toChild),
  }));
}

/** Тухайн хүний сүүлийн бүртгэл ба тоо */
export type ActivityCount = { count: number; last: Date | null };

export type UserActivity = {
  /** Төлөв бүрээр: { todo: 2, done: 5 } */
  tasks: Record<string, number>;
  shifts: { total: number; done: number; upcoming: number; missed: number };
  guardVisits: ActivityCount;
  donationVisits: ActivityCount;
  assetChecks: ActivityCount;
  welfareAids: ActivityCount;
};

export type UserReport = {
  user: AppUser;
  children: DirectoryChild[];
  activity: UserActivity;
};

type CountRow = { count: number; last: string | null } | undefined;

const toCount = (row: CountRow): ActivityCount => ({
  count: row?.count ?? 0,
  last: row?.last ? new Date(row.last) : null,
});

/** Нэг хэрэглэгчийн дэлгэрэнгүй тайлан (зөвхөн админ). */
export async function getUserReport(uid: string): Promise<UserReport> {
  const data = await apiFetch<{
    user: UserRow;
    children: ChildRow[];
    activity: {
      tasks: Record<string, number>;
      shifts?: UserActivity["shifts"];
      guardVisits: CountRow;
      donationVisits: CountRow;
      assetChecks: CountRow;
      welfareAids: CountRow;
    };
  }>(`/api/users/${encodeURIComponent(uid)}`);

  const activity = data.activity;

  return {
    user: toAppUser(data.user),
    children: (data.children ?? []).map(toChild),
    activity: {
      tasks: activity.tasks ?? {},
      shifts: activity.shifts ?? { total: 0, done: 0, upcoming: 0, missed: 0 },
      guardVisits: toCount(activity.guardVisits),
      donationVisits: toCount(activity.donationVisits),
      assetChecks: toCount(activity.assetChecks),
      welfareAids: toCount(activity.welfareAids),
    },
  };
}

/** YYYY-MM-DD → өнөөдрийн байдлаарх бүтэн нас; огноогүй бол null */
export function ageOf(birthDate: string, today = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;

  const [, y, m, d] = match.map(Number);
  let age = today.getFullYear() - y;
  const beforeBirthday =
    today.getMonth() + 1 < m ||
    (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;

  return age >= 0 && age < 150 ? age : null;
}

/** Овог нэр — хоосон бол null */
export const fullNameOf = (user: Pick<AppUser, "first_name" | "last_name">) =>
  [user.last_name, user.first_name].filter(Boolean).join(" ") || null;
