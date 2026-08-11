"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Globe, Landmark, Pencil, Plus, Star, Trash2, Users } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import AccountAccessModal from "@/components/finance/AccountAccessModal";
import AccountFormModal from "@/components/finance/AccountFormModal";
import {
  bankLabel,
  formatAccountNumber,
  type DonationAccount,
} from "@/data/donationAccounts";
import { aimags, labelOf } from "@/data/profileOptions";
import {
  invalidateDonationAccounts,
  useDonationAccounts,
} from "@/hooks/useDonationAccounts";
import { deleteDonationAccount } from "@/lib/donationAccounts";
import { isAdminRole } from "@/lib/permissions";
import { listUsers, type AppUser } from "@/lib/users";

/**
 * Хандивын дансны тохиргоо — зөвхөн админ.
 *
 * Данс нэмэх, засах, устгах, ба дансны ГҮЙЛГЭЭГ хэн харахыг оноох. Дансны
 * карт нь бүх хүнд харагддагийг санана уу: энд оноох эрх нь зөвхөн доторх
 * гүйлгээний тухай.
 */
export default function AccountSettings() {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);

  const { accounts, loading, refresh } = useDonationAccounts();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [editing, setEditing] = useState<DonationAccount | null>(null);
  const [creating, setCreating] = useState(false);
  const [access, setAccess] = useState<DonationAccount | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Эрх оноох цонхонд хэрэгтэй — идэвхтэй хүмүүсийг л санал болгоно.
  // /api/users нь админы route тул эрхгүй бол огт дуудахгүй.
  useEffect(() => {
    if (!isAdmin) return;

    let alive = true;

    listUsers()
      .then((list) => {
        if (alive) setUsers(list.filter((item) => item.status === "active"));
      })
      .catch((err) => {
        console.error("Хэрэглэгч уншихад алдаа гарлаа:", err);
      });

    return () => {
      alive = false;
    };
  }, [isAdmin]);

  const nameByUid = useMemo(
    () =>
      new Map(
        users.map((item) => [
          item.uid,
          [item.first_name, item.last_name].filter(Boolean).join(" ") ||
            item.email,
        ])
      ),
    [users]
  );

  const reload = async () => {
    invalidateDonationAccounts();
    await refresh();
  };

  const handleDelete = async (account: DonationAccount) => {
    // Гүйлгээ нь дугаараар холбогддог тул түүх устахгүй — гэхдээ данс алга
    // болмогц түүний гүйлгээ хаана ч харагдахаа болино
    if (
      !window.confirm(
        `«${account.title}» дансыг устгах уу? Бүртгэгдсэн гүйлгээ нь үлдэх боловч энэ дансаар шүүх боломжгүй болно.`
      )
    ) {
      return;
    }

    setBusyId(account.id);
    setError("");

    try {
      await deleteDonationAccount(account.id);
      await reload();
    } catch (err) {
      console.error("Данс устгахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Устгаж чадсангүй.");
    } finally {
      setBusyId(null);
    }
  };

  // Энгийн хэрэглэгчид энэ хэсэг огт хэрэггүй — картуудыг нь дээр нь харна
  if (!isAdmin) return null;

  return (
    <div className="surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Landmark
            className="h-5 w-5 text-accent-600 dark:text-accent-400"
            strokeWidth={1.8}
          />
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Хандивын данс
            </h2>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Карт нь бүх хүнд харагдана. Гүйлгээ нь эрх сонгоогүй бол мөн
              бүгдэд, сонгосон бол зөвхөн тэдгээрт харагдана
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-3.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} />
          Данс нэмэх
        </button>
      </div>

      {error && (
        <p className="border-b border-gray-100 bg-error-50 px-5 py-3 text-theme-sm text-error-600 dark:border-white/10 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      {loading && accounts.length === 0 && (
        <p className="p-5 text-theme-sm text-gray-500 dark:text-gray-400">
          Ачаалж байна...
        </p>
      )}

      {!loading && accounts.length === 0 && (
        <p className="p-8 text-center text-theme-sm text-gray-400">
          Данс бүртгэгдээгүй байна.
        </p>
      )}

      <ul className="divide-y divide-gray-100 dark:divide-white/10">
        {accounts.map((account) => {
          const granted = account.allowedUids ?? [];
          const grantedAimags = account.allowedAimags ?? [];
          // Хоёулаа хоосон = хязгаарлалт тавиагүй = бүгдэд нээлттэй
          const isOpen = granted.length === 0 && grantedAimags.length === 0;

          return (
            <li
              key={account.id}
              className="flex flex-wrap items-start justify-between gap-4 p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-theme-sm font-semibold text-gray-900 dark:text-white">
                    {account.title}
                  </span>

                  {account.isTithe && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-theme-xs font-medium text-accent-700 dark:bg-accent-500/15 dark:text-accent-300">
                      <Star className="h-3 w-3" strokeWidth={2.2} />
                      1/10 тайлан
                    </span>
                  )}
                </div>

                <p className="mt-1 font-mono text-theme-sm tracking-wide text-gray-700 dark:text-gray-300">
                  {formatAccountNumber(account.number)}
                </p>

                <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                  {[bankLabel(account.bank), account.holder]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>

                <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
                  {isOpen ? (
                    <span className="inline-flex items-center gap-1 text-accent-600 dark:text-accent-400">
                      <Globe className="h-3.5 w-3.5" strokeWidth={1.8} />
                      Гүйлгээг бүх хэрэглэгч харна
                    </span>
                  ) : (
                    <>
                      Гүйлгээ харах эрхтэй:{" "}
                      {[
                        ...grantedAimags.map(
                          (value) => `${labelOf(aimags, value)} (аймаг)`
                        ),
                        ...granted.map((uid) => nameByUid.get(uid) ?? uid),
                      ].join(", ")}
                    </>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAccess(account)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-theme-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  <Users className="h-4 w-4" strokeWidth={1.8} />
                  Эрх оноох
                </button>

                <button
                  type="button"
                  onClick={() => setEditing(account)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-theme-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  <Pencil className="h-4 w-4" strokeWidth={1.8} />
                  Засах
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(account)}
                  disabled={busyId === account.id}
                  aria-label={`«${account.title}» дансыг устгах`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-error-500 transition-colors hover:bg-error-50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-error-500/10"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <AccountFormModal
        isOpen={creating || editing !== null}
        editing={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={reload}
      />

      <AccountAccessModal
        account={access}
        users={users}
        onClose={() => setAccess(null)}
        onSaved={reload}
      />
    </div>
  );
}
