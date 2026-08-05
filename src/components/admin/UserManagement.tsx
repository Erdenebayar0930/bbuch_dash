"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Crown, RefreshCw, ShieldCheck, UserRound } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import { khoroos } from "@/data/khoroos";
import { aimags, labelOf } from "@/data/profileOptions";
import { auth } from "@/lib/firebase";
import ChurchInfoModal from "./ChurchInfoModal";
import {
  asRole,
  canAssignRoles,
  canChangeKhoroo,
  canChangeRole,
  canChangeStatus,
  isSuperRole,
  keepsLastSuper,
  roleDescriptions,
  type Actor,
  type Permission,
} from "@/lib/permissions";
import {
  listUsers,
  roleLabels,
  setUserKhoroo,
  setUserRole,
  setUserStatus,
  statusLabels,
  type AppUser,
  type UserRole,
  type UserStatus,
} from "@/lib/users";

type Filter = "all" | UserStatus;

const filters: { key: Filter; name: string }[] = [
  { key: "all", name: "Бүгд" },
  { key: "pending", name: "Хүлээгдэж буй" },
  { key: "active", name: "Идэвхтэй" },
  { key: "blocked", name: "Хаагдсан" },
];

const statusStyles: Record<UserStatus, string> = {
  active:
    "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  pending:
    "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  blocked: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
};

const roleStyles: Record<UserRole, string> = {
  super:
    "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300",
  admin: "bg-navy-900/5 text-navy-900 dark:bg-white/10 dark:text-white/80",
  user: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400",
};

const dateFormatter = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Хориглосон бол эхний шалтгааныг, зөвшөөрсөн бол undefined буцаана. */
const reasonOf = (...checks: Permission[]): string | undefined => {
  const denied = checks.find((check) => !check.allowed);
  return denied && !denied.allowed ? denied.reason : undefined;
};

export default function UserManagement() {
  const { user: contextUser } = useUser();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** Одоо шинэчлэгдэж буй хэрэглэгчийн uid */
  const [savingUid, setSavingUid] = useState<string | null>(null);
  /** Чуулганы харьяалал засаж буй хэрэглэгч */
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const currentUid = auth.currentUser?.uid ?? contextUser?.uid ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setUsers(await listUsers());
    } catch (err) {
      console.error("Хэрэглэгчдийг ачаалж чадсангүй:", err);
      setError("Хэрэглэгчдийн жагсаалтыг ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc.all += 1;
        acc[user.status] += 1;
        return acc;
      },
      { all: 0, active: 0, pending: 0, blocked: 0 } as Record<Filter, number>
    );
  }, [users]);

  const visible = useMemo(
    () => (filter === "all" ? users : users.filter((u) => u.status === filter)),
    [users, filter]
  );

  /**
   * Нэвтэрсэн хэрэглэгчийн эрх — серверээс ирсэн жагсаалтаас уншина.
   * sessionStorage дахь кэш хуучирсан байж болзошгүй тул түүнийг зөвхөн
   * жагсаалт ачаалагдтал ашиглана.
   */
  const actor: Actor | null = useMemo(() => {
    if (!currentUid) return null;

    const row = users.find((user) => user.uid === currentUid);
    return {
      uid: currentUid,
      role: asRole(row?.role ?? contextUser?.role),
    };
  }, [currentUid, users, contextUser?.role]);

  const isSuper = isSuperRole(actor?.role);

  /** Идэвхтэй супер админы тоо — сүүлчийнхийг нь хамгаалахад хэрэгтэй */
  const activeSuperCount = useMemo(
    () =>
      users.filter((u) => u.role === "super" && u.status === "active").length,
    [users]
  );

  /** Сервер лүү бичээд локал жагсаалтыг шинэчилнэ */
  const apply = async (uid: string, patch: Partial<AppUser>, save: () => Promise<void>) => {
    setSavingUid(uid);
    setError("");

    try {
      await save();
      setUsers((prev) =>
        prev.map((user) => (user.uid === uid ? { ...user, ...patch } : user))
      );
    } catch (err) {
      console.error("Хэрэглэгчийн мэдээллийг шинэчилж чадсангүй:", err);
      // Сервер эрхийн шалтгааныг тодорхой буцаадаг — түүнийг нь харуулна
      setError(
        err instanceof Error
          ? err.message
          : "Өөрчлөлтийг хадгалахад алдаа гарлаа."
      );
    } finally {
      setSavingUid(null);
    }
  };

  const changeRole = (user: AppUser, role: UserRole) =>
    apply(user.uid, { role }, () => setUserRole(user.uid, role));

  const changeStatus = (user: AppUser, status: UserStatus) =>
    apply(user.uid, { status }, () => setUserStatus(user.uid, status));

  const changeKhoroo = (user: AppUser, value: string) => {
    const khoroo = value === "" ? null : Number(value);
    return apply(user.uid, { khoroo }, () => setUserKhoroo(user.uid, khoroo));
  };

  /** Цонхонд хадгалсны дараа локал жагсаалтыг таарууллана */
  const applyChurchInfo = (
    uid: string,
    patch: { aimags: string[]; callings: string[] }
  ) => {
    setUsers((prev) =>
      prev.map((user) => (user.uid === uid ? { ...user, ...patch } : user))
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Эрхийн тайлбар — хэн юу хийж чадахыг нэг харцаар */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(roleLabels) as UserRole[]).map((role) => (
          <div
            key={role}
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-theme-xs font-medium ${roleStyles[role]}`}
              >
                {roleLabels[role]}
              </span>
              <span className="text-theme-xs text-gray-400">
                {users.filter((u) => u.role === role).length}
              </span>
            </div>
            <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
              {roleDescriptions[role]}
            </p>
          </div>
        ))}
      </div>

      {!loading && !isSuper && (
        <p className="rounded-lg bg-warning-50 px-4 py-3 text-theme-sm text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
          Та админ эрхтэй байна. Бүртгэл зөвшөөрөх, хаах, хороо оноох боломжтой
          ч эрх олгох, өөрчлөхийг зөвхөн супер админ хийнэ.
        </p>
      )}

      {/* Шүүлтүүр ба сэргээх */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((item) => {
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
                <span className={isActive ? "ml-1.5 text-white/70" : "ml-1.5 text-gray-400"}>
                  {counts[item.key]}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.8} />
          Сэргээх
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      {/* Жагсаалт */}
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead>
            <tr className="border-b border-gray-200 text-theme-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
              <th className="px-5 py-3.5 font-medium">Хэрэглэгч</th>
              <th className="px-5 py-3.5 font-medium">Утас</th>
              <th className="px-5 py-3.5 font-medium">Эрх</th>
              <th className="px-5 py-3.5 font-medium">Аймаг</th>
              <th className="px-5 py-3.5 font-medium">Хороо</th>
              <th className="px-5 py-3.5 font-medium">Төлөв</th>
              <th className="px-5 py-3.5 font-medium">Бүртгүүлсэн</th>
              <th className="px-5 py-3.5 text-right font-medium">Үйлдэл</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {loading && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-theme-sm text-gray-500">
                  Ачаалж байна...
                </td>
              </tr>
            )}

            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-theme-sm text-gray-500">
                  Хэрэглэгч олдсонгүй.
                </td>
              </tr>
            )}

            {!loading &&
              visible.map((user) => {
                const isSelf = user.uid === currentUid;
                const isSaving = savingUid === user.uid;
                const fullName =
                  [user.first_name, user.last_name].filter(Boolean).join(" ") ||
                  "Нэр оруулаагүй";

                const target = { uid: user.uid, role: user.role };

                // Дүрмүүд серверийнхтэй яг ижил модулиас — зөрөх боломжгүй
                const roleReason = actor
                  ? reasonOf(
                      canAssignRoles(actor, target),
                      keepsLastSuper(target, activeSuperCount, {
                        nextRole: "admin",
                      })
                    )
                  : "Эрх тодорхойлогдоогүй байна.";

                const statusReason = actor
                  ? reasonOf(canChangeStatus(actor, target))
                  : "Эрх тодорхойлогдоогүй байна.";

                const blockReason =
                  statusReason ??
                  (actor
                    ? reasonOf(
                        keepsLastSuper(target, activeSuperCount, {
                          nextStatus: "blocked",
                        })
                      )
                    : undefined);

                const khorooReason = actor
                  ? reasonOf(canChangeKhoroo(actor, target))
                  : "Эрх тодорхойлогдоогүй байна.";

                return (
                  <tr
                    key={user.uid}
                    className={`text-theme-sm ${isSaving ? "opacity-60" : ""}`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white">
                          {user.role === "super" ? (
                            <Crown className="h-4.5 w-4.5" strokeWidth={1.8} />
                          ) : user.role === "admin" ? (
                            <ShieldCheck className="h-4.5 w-4.5" strokeWidth={1.8} />
                          ) : (
                            <UserRound className="h-4.5 w-4.5" strokeWidth={1.8} />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900 dark:text-white">
                            {fullName}
                            {isSelf && (
                              <span className="ml-2 text-theme-xs text-gray-400">(та)</span>
                            )}
                          </p>
                          <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                      {user.phone || "—"}
                    </td>

                    <td className="px-5 py-4">
                      {isSuper && !roleReason ? (
                        <select
                          value={user.role}
                          disabled={isSaving}
                          onChange={(e) =>
                            changeRole(user, e.target.value as UserRole)
                          }
                          title="Хэрэглэгчийн эрхийг өөрчлөх"
                          className="h-9 rounded-lg border border-gray-300 bg-white px-2.5 text-theme-sm text-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-gray-900 dark:text-white/90"
                        >
                          <option value="super">{roleLabels.super}</option>
                          <option value="admin">{roleLabels.admin}</option>
                          <option value="user">{roleLabels.user}</option>
                        </select>
                      ) : (
                        <span
                          title={roleReason}
                          className={`inline-flex cursor-default rounded-full px-2.5 py-1 text-theme-xs font-medium ${
                            roleStyles[user.role]
                          }`}
                        >
                          {roleLabels[user.role]}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setEditingUser(user)}
                        disabled={isSaving || !!khorooReason}
                        title={
                          khorooReason ?? "Аймаг, дуудлага оноох (зөвхөн админ)"
                        }
                        className="flex max-w-[220px] flex-wrap gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-left transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/5"
                      >
                        {user.aimags.length === 0 && user.callings.length === 0 ? (
                          <span className="text-theme-xs text-gray-400">
                            Оноох
                          </span>
                        ) : (
                          <>
                            {user.aimags.map((value) => (
                              <span
                                key={value}
                                className="rounded-full bg-accent-50 px-2 py-0.5 text-theme-xs font-medium text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                              >
                                {labelOf(aimags, value)}
                              </span>
                            ))}
                            {user.callings.length > 0 && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-theme-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">
                                {user.callings.length} дуудлага
                              </span>
                            )}
                          </>
                        )}
                      </button>
                    </td>

                    <td className="px-5 py-4">
                      <select
                        value={user.khoroo ?? ""}
                        disabled={isSaving || !!khorooReason}
                        onChange={(e) => changeKhoroo(user, e.target.value)}
                        title={khorooReason ?? "Мэдэгдэл хүлээн авах хороо"}
                        className="h-9 rounded-lg border border-gray-300 bg-white px-2.5 text-theme-sm text-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-gray-900 dark:text-white/90"
                      >
                        <option value="">—</option>
                        {khoroos.map((khoroo) => (
                          <option key={khoroo.id} value={khoroo.id}>
                            {khoroo.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-theme-xs font-medium ${
                          statusStyles[user.status]
                        }`}
                      >
                        {statusLabels[user.status]}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                      {user.createdAt ? dateFormatter.format(user.createdAt) : "—"}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {user.status !== "active" && (
                          <button
                            type="button"
                            onClick={() => changeStatus(user, "active")}
                            disabled={isSaving || !!statusReason}
                            title={statusReason}
                            className="rounded-lg bg-accent-600 px-3 py-1.5 text-theme-xs font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {user.status === "pending" ? "Зөвшөөрөх" : "Сэргээх"}
                          </button>
                        )}

                        {user.status !== "blocked" && !isSelf && (
                          <button
                            type="button"
                            onClick={() => changeStatus(user, "blocked")}
                            disabled={isSaving || !!blockReason}
                            title={blockReason}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-theme-xs font-medium text-error-600 transition-colors hover:bg-error-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:hover:bg-error-500/10"
                          >
                            Хаах
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <ChurchInfoModal
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSaved={applyChurchInfo}
      />
    </div>
  );
}
