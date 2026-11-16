"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  UserRound,
} from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import GospelAreaManager from "@/components/gospel/GospelAreaManager";
import GospelContactModal from "@/components/gospel/GospelContactModal";
import { gospelAimags, type GospelAimag } from "@/data/gospelOptions";
import { aimags as aimagOptions, genders, labelOf } from "@/data/profileOptions";
import {
  deleteGospelContact,
  listGospelAreas,
  listGospelContacts,
  type GospelArea,
  type GospelContact,
} from "@/lib/gospel";
import { isAdminRole } from "@/lib/permissions";
import { deleteGospelPhoto } from "@/lib/storage";
import { dateFormat } from "@/lib/dateFormat";

type GospelRegistryProps = {
  /** Аль аймгийн цэснээс нээгдсэн — шинэ бүртгэлийн анхдагч аймаг */
  aimag: GospelAimag;
};

/** Баптисмаар шүүх сонголт */
type BaptismFilter = "" | "holy_spirit" | "water" | "none";

const baptismFilters: { value: BaptismFilter; label: string }[] = [
  { value: "", label: "Бүх бүртгэл" },
  { value: "holy_spirit", label: "Ариун сүнсний баптисм авсан" },
  { value: "water", label: "Усан баптисм авсан" },
  { value: "none", label: "Баптисм аваагүй" },
];

const baptismBadge =
  "rounded-full bg-success-50 px-2 py-0.5 text-theme-xs font-medium text-success-700 dark:bg-success-500/15 dark:text-success-400";

const dateFormatter = dateFormat;

/** YYYY-MM-DD → уншигдах огноо (цагийн бүсээс хамаарахгүйгээр) */
const formatDate = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return y ? dateFormatter.format(new Date(y, m - 1, d)) : value;
};

/**
 * «Сайн мэдээ» хүргэсэн хүмүүсийн бүртгэл.
 *
 * Дээд талд нь таб (УБ хотын, ОУ-ын, Хөдөө орон нутгийн г.м.), доор нь тухайн
 * табын задаргаа. Таб ба задаргааг админ «Ангилал засах» цонхоор удирдана.
 *
 * Харуул, Магтаал, Агуу захирамжийн аймаг нэг санг хамтран харна. Гишүүн
 * бүр бүртгэж, өөрийнхөө бүртгэлийг засна; устгах нь зөвхөн админд.
 */
export default function GospelRegistry({ aimag }: GospelRegistryProps) {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);

  const [contacts, setContacts] = useState<GospelContact[]>([]);
  const [areas, setAreas] = useState<GospelArea[]>([]);
  /** Нээлттэй таб; null бол эхнийх */
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  /** Нээлттэй задаргаа; "" бол тухайн табын бүгд */
  const [activeAreaId, setActiveAreaId] = useState("");
  const [managerOpen, setManagerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [baptismFilter, setBaptismFilter] = useState<BaptismFilter>("");
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
      const [nextAreas, nextContacts] = await Promise.all([
        listGospelAreas(),
        listGospelContacts(),
      ]);
      setAreas(nextAreas);
      setContacts(nextContacts);
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

  const tabs = useMemo(() => areas.filter((area) => !area.parentId), [areas]);
  const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);

  // Хасагдсан таб/задаргаа сонгогдсон хэвээр үлдэхгүй
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null;
  const subAreas = useMemo(
    () => (activeTab ? areas.filter((area) => area.parentId === activeTab.id) : []),
    [areas, activeTab]
  );
  const activeArea = subAreas.find((area) => area.id === activeAreaId) ?? null;

  /** Бүртгэл аль табд хамаарах — задаргаа бол эцэг нь, таб бол өөрөө */
  const tabOf = useCallback(
    (contact: GospelContact) => {
      const area = areaById.get(contact.areaId);
      return area ? (area.parentId ?? area.id) : null;
    },
    [areaById]
  );

  /** Нээлттэй таб (ба задаргаа)-ны бүртгэлүүд — хайлтаас өмнө */
  const inScope = useMemo(
    () =>
      contacts.filter((item) => {
        if (!activeTab || tabOf(item) !== activeTab.id) return false;
        return !activeArea || item.areaId === activeArea.id;
      }),
    [contacts, activeTab, activeArea, tabOf]
  );

  /** Задаргаа бүрийн бүртгэлийн тоо — товч дээр харуулна */
  const countByArea = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of contacts) {
      counts.set(item.areaId, (counts.get(item.areaId) ?? 0) + 1);
    }
    return counts;
  }, [contacts]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return inScope.filter((item) => {
      if (baptismFilter === "holy_spirit" && !item.holySpiritBaptismDate) return false;
      if (baptismFilter === "water" && !item.waterBaptismDate) return false;
      if (
        baptismFilter === "none" &&
        (item.holySpiritBaptismDate || item.waterBaptismDate)
      ) {
        return false;
      }
      if (mineOnly && item.sharedBy !== user?.uid) return false;
      if (!needle) return true;

      return [item.name, item.phone, item.address, item.note, item.sharedByName]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [inScope, query, baptismFilter, mineOnly, user?.uid]);

  /** Шинэ бүртгэлийн анхдагч ангилал — сонгосон задаргаа, эс бөгөөс эхнийх */
  const defaultAreaId = activeArea?.id ?? subAreas[0]?.id ?? activeTab?.id ?? "";

  const selectTab = (id: string) => {
    setActiveTabId(id);
    setActiveAreaId("");
  };

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
      // Бүртгэсэн өдрөөр нь шинээс хуучин руу
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
      void deleteGospelPhoto(contact.photoPath);
      setContacts((prev) => prev.filter((item) => item.id !== contact.id));
    } catch (err) {
      console.error("Бүртгэл устгахад алдаа гарлаа:", err);
      window.alert(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    }
  };

  const canEdit = (contact: GospelContact) =>
    isAdmin || (!!user?.uid && contact.sharedBy === user.uid);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-2 border-b border-gray-200 dark:border-white/10">
        <div
          role="tablist"
          aria-label="Сайн мэдээний ангилал"
          className="-mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto"
        >
          {tabs.map((tab) => {
            const selected = tab.id === activeTab?.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectTab(tab.id)}
                className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-theme-sm font-medium transition-colors ${
                  selected
                    ? "border-accent-600 text-accent-700 dark:border-accent-400 dark:text-accent-300"
                    : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {tab.name}
              </button>
            );
          })}
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setManagerOpen(true)}
            className="mb-1.5 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            <Settings2 className="h-4 w-4" strokeWidth={1.8} />
            Ангилал засах
          </button>
        )}
      </div>

      {subAreas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[{ id: "", name: "Бүгд" }, ...subAreas].map((area) => {
            const selected = (activeArea?.id ?? "") === area.id;
            const count = area.id
              ? (countByArea.get(area.id) ?? 0)
              : subAreas.reduce((sum, item) => sum + (countByArea.get(item.id) ?? 0), 0);
            return (
              <button
                key={area.id || "all"}
                type="button"
                onClick={() => setActiveAreaId(area.id)}
                aria-pressed={selected}
                className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3.5 py-1.5 text-left text-theme-sm font-medium transition-colors ${
                  selected
                    ? "border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                }`}
              >
                <span className="min-w-0">{area.name}</span>
                <span className="shrink-0 text-theme-xs opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      )}

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
            value={baptismFilter}
            onChange={(event) => setBaptismFilter(event.target.value as BaptismFilter)}
            aria-label="Баптисмаар шүүх"
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            {baptismFilters.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
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

          {allowedAimags.length > 0 && defaultAreaId && (
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
            {tabs.length === 0
              ? isAdmin
                ? "Ангилал алга. «Ангилал засах» товчоор таб нэмнэ үү."
                : "Ангилал хараахан тохируулагдаагүй байна. Админд хандана уу."
              : inScope.length === 0
                ? "Энэ хэсэгт бүртгэл алга. «Бүртгэх» товчоор эхний хүнээ нэмээрэй."
              : "Хайлтад тохирох бүртгэл олдсонгүй."}
          </p>
        )}

        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-white/5">
          {visible.map((contact) => {
            const details = [
              contact.phone,
              labelOf(genders, contact.gender) || "",
              contact.birthYear ? `${contact.birthYear} он` : "",
              contact.address,
            ].filter(Boolean);

            return (
              <li key={contact.id} className="flex items-start gap-3 py-3">
                {contact.photoUrl ? (
                  <a
                    href={contact.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0"
                    aria-label={`«${contact.name}»-ийн зургийг томоор харах`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- Firebase Storage URL */}
                    <img
                      src={contact.photoUrl}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  </a>
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-gray-500">
                    <UserRound className="h-5 w-5" strokeWidth={1.6} />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {contact.name}
                    </span>
                    {contact.holySpiritBaptismDate && (
                      <span className={baptismBadge}>
                        Ариун сүнс · {formatDate(contact.holySpiritBaptismDate)}
                      </span>
                    )}
                    {contact.waterBaptismDate && (
                      <span className={baptismBadge}>
                        Усан баптисм · {formatDate(contact.waterBaptismDate)}
                      </span>
                    )}
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
                    {!activeArea && areaById.get(contact.areaId)?.parentId
                      ? ` · ${areaById.get(contact.areaId)?.name}`
                      : ""}
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
        areas={areas}
        defaultAreaId={defaultAreaId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      {isAdmin && (
        <GospelAreaManager
          isOpen={managerOpen}
          areas={areas}
          onClose={() => setManagerOpen(false)}
          onChanged={async () => setAreas(await listGospelAreas())}
        />
      )}
    </div>
  );
}
