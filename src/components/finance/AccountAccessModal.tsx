"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Globe, Search } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { type DonationAccount } from "@/data/donationAccounts";
import { aimags } from "@/data/profileOptions";
import { updateDonationAccount } from "@/lib/donationAccounts";
import { isAdminRole } from "@/lib/permissions";

import type { AppUser } from "@/lib/users";

type AccountAccessModalProps = {
  /** null бол цонх хаалттай */
  account: DonationAccount | null;
  users: AppUser[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

/**
 * Дансны гүйлгээг хэн харахыг оноох цонх.
 *
 * Хоёр аргаар онооно: АЙМГААР (тухайн аймгийн бүх гишүүн, шинээр нэмэгдсэн
 * хүн ч дагана) эсвэл ХҮН тус бүрээр. Хоёулаа хоосон бол данс нь БҮГДЭД
 * нээлттэй — хязгаарлалт тавиагүй гэсэн үг.
 *
 * Админ ба super нь юу сонгосноос үл хамааран бүх дансыг хардаг тул
 * жагсаалтад тэмдэглэгээтэй харагдаж, дахин сонгуулахгүй.
 */
export default function AccountAccessModal({
  account,
  users,
  onClose,
  onSaved,
}: AccountAccessModalProps) {
  const [uids, setUids] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Цонх нээгдэх бүрд тухайн дансны утгаар дүүргэнэ
  useEffect(() => {
    setUids(account?.allowedUids ?? []);
    setGroups(account?.allowedAimags ?? []);
    setQuery("");
    setError("");
  }, [account]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;

    return users.filter((user) =>
      [user.first_name, user.last_name, user.email]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [users, query]);

  /** Аль нэг нь сонгогдоогүй бол данс нээлттэй хэвээр */
  const isOpen = uids.length === 0 && groups.length === 0;

  if (!account) return null;

  const toggleUid = (uid: string, checked: boolean) => {
    setUids((prev) =>
      checked ? [...prev, uid] : prev.filter((item) => item !== uid)
    );
  };

  const toggleGroup = (value: string, checked: boolean) => {
    setGroups((prev) =>
      checked ? [...prev, value] : prev.filter((item) => item !== value)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    try {
      await updateDonationAccount(account.id, {
        allowedUids: uids,
        allowedAimags: groups,
      });
      await onSaved();
      onClose();
    } catch (err) {
      console.error("Эрх хадгалахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Хадгалж чадсангүй.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} className="mx-4 max-w-[600px] p-0">
      <div className="flex max-h-[85vh] flex-col">
        <div className="shrink-0 p-5 pb-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Гүйлгээ харах эрх
          </h3>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            «{account.title}» — дансны карт нь бүх хүнд хэвээр харагдана. Энд
            зөвхөн доторх гүйлгээг хэн харахыг тогтооно.
          </p>

          {/* Хоосон үлдээх нь «хаалттай» биш «нээлттэй» гэсэн үг — үүнийг
              тодорхой хэлэхгүй бол админ санамсаргүй бүгдэд нээж орхино */}
          <p
            className={`mt-3 flex items-start gap-2 rounded-lg px-4 py-3 text-theme-sm ${
              isOpen
                ? "bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300"
                : "bg-gray-50 text-gray-600 dark:bg-white/[0.04] dark:text-gray-300"
            }`}
          >
            <Globe className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span>
              {isOpen ? (
                <>
                  Одоогоор <strong>бүх хэрэглэгчид</strong> харагдана. Аймаг
                  эсвэл хүн сонгомогц зөвхөн тэдгээрт хязгаарлагдана.
                </>
              ) : (
                <>
                  Сонгосон {groups.length > 0 && `${groups.length} аймаг`}
                  {groups.length > 0 && uids.length > 0 && ", "}
                  {uids.length > 0 && `${uids.length} хүн`} ба админ харна.
                  Бүгдэд нээхийн тулд сонголтоо бүгдийг нь арилгана.
                </>
              )}
            </span>
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* Аймгаар */}
          <p className="mb-2 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            Аймгаар
          </p>
          <div className="flex flex-wrap gap-2">
            {aimags.map((aimag) => {
              const checked = groups.includes(aimag.value);

              return (
                <label
                  key={aimag.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-theme-sm transition-colors ${
                    checked
                      ? "border-accent-400 bg-accent-50/60 text-accent-800 dark:border-accent-500/50 dark:bg-accent-500/10 dark:text-accent-200"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      toggleGroup(aimag.value, event.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500/30 dark:border-white/20 dark:bg-white/10"
                  />
                  {aimag.label}
                </label>
              );
            })}
          </div>

          {/* Хүн тус бүрээр */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
              Хүн тус бүрээр
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Нэр, и-мэйлээр хайх"
                className="h-9 w-full min-w-[220px] rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
              />
            </div>
          </div>

          <ul className="mt-2 flex flex-col gap-1">
            {visible.length === 0 && (
              <li className="py-6 text-center text-theme-sm text-gray-400">
                Хэрэглэгч олдсонгүй.
              </li>
            )}

            {visible.map((user) => {
              const isAdmin = isAdminRole(user.role);
              // Аймгаар нь эрх авчихсан хүнийг дахин сонгуулах шаардлагагүй
              const viaGroup = (user.aimags ?? []).some((item) =>
                groups.includes(item)
              );
              const checked = uids.includes(user.uid);
              const locked = isAdmin || viaGroup;

              const fullName =
                [user.first_name, user.last_name].filter(Boolean).join(" ") ||
                user.email;

              return (
                <li key={user.uid}>
                  <label
                    className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors ${
                      locked
                        ? "cursor-default border-gray-100 dark:border-white/5"
                        : "cursor-pointer border-gray-200 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/[0.03]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={locked || checked}
                      disabled={locked}
                      onChange={(event) =>
                        toggleUid(user.uid, event.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500/30 disabled:opacity-50 dark:border-white/20 dark:bg-white/10"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-theme-sm text-gray-800 dark:text-white/90">
                        {fullName}
                      </span>
                      <span className="block truncate text-theme-xs text-gray-400">
                        {user.email}
                      </span>
                    </span>

                    {isAdmin ? (
                      <span className="shrink-0 text-theme-xs text-gray-400">
                        Админ — бүгдийг харна
                      </span>
                    ) : (
                      viaGroup && (
                        <span className="shrink-0 text-theme-xs text-gray-400">
                          Аймгаараа
                        </span>
                      )
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="shrink-0 border-t border-gray-100 p-5 dark:border-white/10">
          {error && (
            <p className="mb-3 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
            >
              Буцах
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Хадгалж байна..." : "Хадгалах"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
