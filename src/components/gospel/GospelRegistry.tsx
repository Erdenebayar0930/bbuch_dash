"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import GospelContactModal from "@/components/gospel/GospelContactModal";
import {
  gospelAimags,
  gospelResponseLabels,
  gospelResponses,
  type GospelAimag,
  type GospelResponse,
} from "@/data/gospelOptions";
import { aimags as aimagOptions, genders, labelOf } from "@/data/profileOptions";
import {
  deleteGospelContact,
  listGospelContacts,
  type GospelContact,
} from "@/lib/gospel";
import { isAdminRole } from "@/lib/permissions";

type GospelRegistryProps = {
  /** Аль аймгийн цэснээс нээгдсэн — шинэ бүртгэлийн анхдагч аймаг */
  aimag: GospelAimag;
};

const responseBadge: Record<GospelResponse, string> = {
  accepted:
    "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  interested:
    "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  declined: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400",
};

const dateFormatter = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/** YYYY-MM-DD → уншигдах огноо (цагийн бүсээс хамаарахгүйгээр) */
const formatDate = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return y ? dateFormatter.format(new Date(y, m - 1, d)) : value;
};

/** Энэ сарын эхэн, YYYY-MM-01 — Улаанбаатарын цагаар */
const monthStart = () =>
  `${new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
  }).format(new Date())}-01`;

/**
 * «Сайн мэдээ» хүргэсэн хүмүүсийн бүртгэл.
 *
 * Харуул, Магтаал, Агуу захирамжийн аймаг нэг санг хамтран харна. Гишүүн
 * бүр бүртгэж, өөрийнхөө бүртгэлийг засна; устгах нь зөвхөн админд.
 */
export default function GospelRegistry({ aimag }: GospelRegistryProps) {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);

  const [contacts, setContacts] = useState<GospelContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [responseFilter, setResponseFilter] = useState<GospelResponse | "">("");
  const [mineOnly, setMineOnly] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GospelContact | null>(null);

  /** Бүртгэхдээ сонгож болох аймгууд — админд бүгд, бусдад өөрийнх нь */
  const allowedAimags = useMemo<GospelAimag[]>(
    () =>
      isAdmin
        ? [...gospelAimags]
        : gospelAimags.filter((item) => (user?.aimags ?? []).includes(item)),
    [isAdmin, user?.aimags]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setContacts(await listGospelContacts());
    } catch (err) {
      console.error("Сайн мэдээний бүртгэл ачаалж чадсангүй:", err);
      setError(err instanceof Error ? err.message : "Ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const since = monthStart();
    return {
      total: contacts.length,
      accepted: contacts.filter((item) => item.response === "accepted").length,
      thisMonth: contacts.filter((item) => item.sharedOn >= since).length,
      mine: contacts.filter((item) => item.sharedBy === user?.uid).length,
    };
  }, [contacts, user?.uid]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return contacts.filter((item) => {
      if (responseFilter && item.response !== responseFilter) return false;
      if (mineOnly && item.sharedBy !== user?.uid) return false;
      if (!needle) return true;

      return [item.name, item.phone, item.address, item.note, item.sharedByName]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [contacts, query, responseFilter, mineOnly, user?.uid]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (contact: GospelContact) => {
    setEditing(contact);
    setModalOpen(true);
  };

  const handleSaved = (saved: GospelContact) => {
    setContacts((prev) => {
      const exists = prev.some((item) => item.id === saved.id);
      const next = exists
        ? prev.map((item) => (item.id === saved.id ? saved : item))
        : [saved, ...prev];
      // Хүргэсэн өдрөөр нь шинээс хуучин руу
      return next.sort((a, b) =>
        a.sharedOn === b.sharedOn
          ? b.createdAt.getTime() - a.createdAt.getTime()
          : b.sharedOn.localeCompare(a.sharedOn)
      );
    });
  };

  const handleDelete = async (contact: GospelContact) => {
    if (!window.confirm(`«${contact.name}»-ийн бүртгэлийг устгах уу?`)) return;

    try {
      await deleteGospelContact(contact.id);
      setContacts((prev) => prev.filter((item) => item.id !== contact.id));
    } catch (err) {
      console.error("Бүртгэл устгахад алдаа гарлаа:", err);
      window.alert(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    }
  };

  const canEdit = (contact: GospelContact) =>
    isAdmin || (!!user?.uid && contact.sharedBy === user.uid);

  const statCards = [
    { label: "Нийт", value: stats.total },
    { label: "Хүлээн авсан", value: stats.accepted },
    { label: "Энэ сард", value: stats.thisMonth },
    { label: "Миний хүргэсэн", value: stats.mine },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="surface p-4">
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="surface flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              strokeWidth={1.8}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Нэр, утас, хаягаар хайх"
              className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3.5 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
            />
          </div>

          <select
            value={responseFilter}
            onChange={(event) =>
              setResponseFilter(event.target.value as GospelResponse | "")
            }
            aria-label="Хариугаар шүүх"
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            <option value="">Бүх хариу</option>
            {gospelResponses.map((value) => (
              <option key={value} value={value}>
                {gospelResponseLabels[value]}
              </option>
            ))}
          </select>

          <label className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 text-theme-sm text-gray-700 dark:border-white/10 dark:text-gray-300">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(event) => setMineOnly(event.target.checked)}
              className="h-4 w-4 accent-accent-600"
            />
            Миний
          </label>

          <button
            type="button"
            onClick={load}
            aria-label="Шинэчлэх"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.8} />
          </button>

          {allowedAimags.length > 0 && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-4 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Бүртгэх
            </button>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}

        {loading && contacts.length === 0 && (
          <p className="py-8 text-center text-theme-sm text-gray-500">Ачаалж байна...</p>
        )}

        {!loading && !error && visible.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-theme-sm text-gray-400 dark:border-white/10">
            {contacts.length === 0
              ? "Одоогоор бүртгэл алга. «Бүртгэх» товчоор эхний хүнээ нэмээрэй."
              : "Хайлтад тохирох бүртгэл олдсонгүй."}
          </p>
        )}

        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-white/5">
          {visible.map((contact) => {
            const details = [
              contact.phone,
              labelOf(genders, contact.gender) || "",
              contact.age ? `${contact.age} настай` : "",
              contact.address,
            ].filter(Boolean);

            return (
              <li key={contact.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {contact.name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-theme-xs font-medium ${responseBadge[contact.response]}`}
                    >
                      {gospelResponseLabels[contact.response]}
                    </span>
                  </div>

                  {details.length > 0 && (
                    <p className="mt-0.5 text-theme-sm text-gray-600 dark:text-gray-400">
                      {details.join(" · ")}
                    </p>
                  )}

                  {contact.note && (
                    <p className="mt-1 whitespace-pre-line text-theme-sm text-gray-500 dark:text-gray-400">
                      {contact.note}
                    </p>
                  )}

                  <p className="mt-1 text-theme-xs text-gray-400">
                    {formatDate(contact.sharedOn)} · {contact.sharedByName} ·{" "}
                    {labelOf(aimagOptions, contact.aimag)}
                  </p>
                </div>

                <div className="flex gap-1">
                  {canEdit(contact) && (
                    <button
                      type="button"
                      onClick={() => openEdit(contact)}
                      aria-label={`«${contact.name}»-ийг засах`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-200"
                    >
                      <Pencil className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(contact)}
                      aria-label={`«${contact.name}»-ийг устгах`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <GospelContactModal
        isOpen={modalOpen}
        contact={editing}
        defaultAimag={aimag}
        allowedAimags={allowedAimags}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
