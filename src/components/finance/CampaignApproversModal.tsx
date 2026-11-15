"use client";

import React, { useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { loadApprovers, saveApprovers } from "@/lib/campaigns";
import { listUsers, type AppUser } from "@/lib/users";

type CampaignApproversModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const fullName = (user: AppUser) =>
  [user.last_name, user.first_name].filter(Boolean).join(" ") || user.email;

/**
 * Хандив зөвшөөрөх эрхтэй хүмүүсийг сонгоно — зөвхөн админ.
 * Хэнийг ч сонгоогүй бол админ зөвшөөрнө.
 */
export default function CampaignApproversModal({ isOpen, onClose }: CampaignApproversModalProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    setQuery("");
    Promise.all([listUsers(), loadApprovers()])
      .then(([rows, uids]) => {
        setUsers(
          rows
            .filter((row) => row.status === "active")
            .sort((a, b) => fullName(a).localeCompare(fullName(b), "mn"))
        );
        setPicked(new Set(uids));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Ачаалахад алдаа гарлаа."))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? users.filter((user) => fullName(user).toLowerCase().includes(needle))
      : users;
    // Сонгогдсон нь дээрээ
    return [...list].sort((a, b) => Number(picked.has(b.uid)) - Number(picked.has(a.uid)));
  }, [users, query, picked]);

  const toggle = (uid: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveApprovers([...picked]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md p-0">
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Хандив зөвшөөрөгчид</h3>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Сонгосон хүмүүс зарласан хандивыг зөвшөөрөх эсвэл өөрчлүүлэхээр буцаана.
          Хэнийг ч сонгоогүй бол админ зөвшөөрнө.
        </p>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Нэрээр хайх"
          aria-label="Нэрээр хайх"
          className="mt-4 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
        />

        <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-white/10">
          {loading ? (
            <p className="py-6 text-center text-theme-sm text-gray-500">Ачаалж байна...</p>
          ) : shown.length === 0 ? (
            <p className="py-6 text-center text-theme-sm text-gray-400">Хэрэглэгч олдсонгүй.</p>
          ) : (
            shown.map((user) => (
              <label
                key={user.uid}
                className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2.5 text-theme-sm last:border-b-0 hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  checked={picked.has(user.uid)}
                  onChange={() => toggle(user.uid)}
                  className="h-4 w-4 accent-accent-600"
                />
                <span className="text-gray-800 dark:text-white/90">{fullName(user)}</span>
              </label>
            ))
          )}
        </div>

        <p className="mt-2 text-theme-xs text-gray-500">{picked.size} хүн сонгосон</p>

        {error && (
          <p className="mt-3 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            Болих
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Хадгалж байна..." : "Хадгалах"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
