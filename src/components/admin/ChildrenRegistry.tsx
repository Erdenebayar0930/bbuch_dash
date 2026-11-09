"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Cake, RefreshCw, Search } from "lucide-react";

import ExportButton from "@/components/common/ExportButton";
import { aimags, genders, labelOf } from "@/data/profileOptions";
import {
  ageOf,
  fullNameOf,
  listDirectory,
  type DirectoryChild,
  type DirectoryUser,
} from "@/lib/userDirectory";

/** Насны ангилал — хүүхдийн үйлчлэлийн бүлгүүдтэй ойролцоо */
const ageGroups = [
  { key: "0-2", label: "Нярай (0–2)", min: 0, max: 2 },
  { key: "3-5", label: "Цэцэрлэг (3–5)", min: 3, max: 5 },
  { key: "6-11", label: "Бага анги (6–11)", min: 6, max: 11 },
  { key: "12-17", label: "Өсвөр (12–17)", min: 12, max: 17 },
  { key: "18+", label: "Насанд хүрсэн (18+)", min: 18, max: Infinity },
] as const;

type AgeGroupKey = (typeof ageGroups)[number]["key"] | "unknown";

const groupOf = (age: number | null): AgeGroupKey =>
  age === null
    ? "unknown"
    : (ageGroups.find((group) => age >= group.min && age <= group.max)?.key ??
      "unknown");

/**
 * Давхардлын төлөв:
 * - `merged` — нэр, төрсөн огноо ижил тул нэг мөр болгосон (хоёр эцэг эх)
 * - `possible` — нэр ижил ч огноо зөрүүтэй/хоосон, өөр хүн бүртгэсэн —
 *   нэг хүүхэд байж магадгүй тул админ шалгана
 */
type DuplicateState = "merged" | "possible" | null;

/** Нэг хүүхэд ба түүнийг бүртгэсэн эцэг эх (нэг эсвэл хоёр) */
type ChildEntry = DirectoryChild & {
  key: string;
  age: number | null;
  group: AgeGroupKey;
  parents: DirectoryUser[];
  duplicate: DuplicateState;
};

/** Нэрийг харьцуулахад — том жижиг үсэг, илүү зай хамаарахгүй */
const normalizeName = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Хэрэглэгч бүрийн хүүхдийг нэг жагсаалт болгоно.
 *
 * Эхнэр нөхөр хоёулаа бүртгэлтэй бол нэг хүүхдийг хоёулаа оруулсан байж
 * болно — нэр ба төрсөн огноо ижил бол нэг мөр болгож эцэг эхийг нь
 * нэгтгэнэ. Огноогүй бол андуурч нэгтгэхгүйн тулд тусад нь үлдээнэ.
 */
function collectChildren(users: DirectoryUser[]): ChildEntry[] {
  const byKey = new Map<string, ChildEntry>();

  for (const user of users) {
    user.children.forEach((child, index) => {
      const key = child.birthDate
        ? `${normalizeName(child.name)}|${child.birthDate}`
        : `${user.uid}|${index}`;

      const existing = byKey.get(key);
      if (existing) {
        // Нэг хүн нэг хүүхдээ хоёр удаа оруулсан ч энд нийлнэ
        if (!existing.parents.some((parent) => parent.uid === user.uid)) {
          existing.parents.push(user);
        }
        existing.duplicate = "merged";
        if (!existing.gender && child.gender) existing.gender = child.gender;
        return;
      }

      const age = ageOf(child.birthDate);
      byKey.set(key, {
        ...child,
        key,
        age,
        group: groupOf(age),
        parents: [user],
        duplicate: null,
      });
    });
  }

  // Нэр ижил боловч нэгтгэгдээгүй мөрүүд — өөр өөр хүн бүртгэсэн бол
  // нэг хүүхэд байж магадгүй (нэг нь огноогоо буруу/хоосон оруулсан г.м.)
  const byName = new Map<string, ChildEntry[]>();
  for (const entry of byKey.values()) {
    const name = normalizeName(entry.name);
    if (!name) continue;
    const list = byName.get(name);
    if (list) list.push(entry);
    else byName.set(name, [entry]);
  }

  for (const list of byName.values()) {
    if (list.length < 2) continue;
    const registrants = new Set(list.flatMap((entry) => entry.parents.map((p) => p.uid)));
    // Нэг хүн ижил нэртэй хоёр хүүхэд (огноо өөр) — ихэр биш л бол ховор,
    // гэхдээ хэд хэдэн хүн бүртгэсэн үед л сэжиглэнэ
    if (registrants.size < 2) continue;
    for (const entry of list) {
      if (entry.duplicate === null) entry.duplicate = "possible";
    }
  }

  // Бага нь эхэндээ, огноогүй нь хамгийн сүүлд
  return [...byKey.values()].sort((a, b) => {
    if (!a.birthDate) return b.birthDate ? 1 : a.name.localeCompare(b.name);
    if (!b.birthDate) return -1;
    return b.birthDate.localeCompare(a.birthDate);
  });
}

const fieldClass =
  "h-10 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-800 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-gray-900 dark:text-white/90";

/** YYYY-MM-DD-ийн сар нь энэ сар мөн эсэх */
const bornThisMonth = (birthDate: string, month: number) =>
  /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && Number(birthDate.slice(5, 7)) === month;

function Stat({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border p-3.5 text-left transition-colors ${
        active
          ? "border-accent-500 bg-accent-50 dark:bg-accent-500/10"
          : "border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/5"
      }`}
    >
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
        {value}
      </p>
    </button>
  );
}

/** Хүүхдийн бүртгэл — бүх хэрэглэгчийн хүүхдийг нэг дор (зөвхөн админ). */
export default function ChildrenRegistry() {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [gender, setGender] = useState("");
  const [group, setGroup] = useState<"" | AgeGroupKey>("");
  const [aimag, setAimag] = useState("");
  const [birthdays, setBirthdays] = useState(false);
  /** Зөвхөн давхардсан / давхардсан байж болзошгүйг харуулах */
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);

  const month = new Date().getMonth() + 1;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setUsers(await listDirectory());
    } catch (err) {
      console.error("Хүүхдийн бүртгэлийг ачаалж чадсангүй:", err);
      setError("Хүүхдийн бүртгэлийг ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const all = useMemo(() => collectChildren(users), [users]);

  /** Насны бүлэг ба төрсөн сараас бусад шүүлтүүр — тоонууд эндээс */
  const base = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return all.filter((child) => {
      if (gender && child.gender !== gender) return false;
      if (aimag && !child.parents.some((parent) => parent.aimags.includes(aimag)))
        return false;
      if (
        needle &&
        ![child.name, ...child.parents.flatMap((p) => [p.first_name, p.last_name, p.phone])]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [all, query, gender, aimag]);

  const visible = useMemo(
    () =>
      base.filter(
        (child) =>
          (!group || child.group === group) &&
          (!birthdays || bornThisMonth(child.birthDate, month)) &&
          (!duplicatesOnly || child.duplicate !== null)
      ),
    [base, group, birthdays, month, duplicatesOnly]
  );

  const counts = useMemo(() => {
    const byGroup = Object.fromEntries(
      [...ageGroups.map((g) => g.key), "unknown"].map((key) => [key, 0])
    ) as Record<AgeGroupKey, number>;
    for (const child of base) byGroup[child.group] += 1;

    return {
      byGroup,
      boys: base.filter((c) => c.gender === "male").length,
      girls: base.filter((c) => c.gender === "female").length,
      birthdays: base.filter((c) => bornThisMonth(c.birthDate, month)).length,
      families: new Set(base.map((c) => c.parents[0].uid)).size,
      merged: base.filter((c) => c.duplicate === "merged").length,
      possible: base.filter((c) => c.duplicate === "possible").length,
    };
  }, [base, month]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Нийт хүүхэд"
          value={base.length}
          active={!group && !birthdays && !duplicatesOnly}
          onClick={() => {
            setGroup("");
            setBirthdays(false);
            setDuplicatesOnly(false);
          }}
        />
        <div className="rounded-xl border border-gray-200 bg-white p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">Хүү / Охин</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
            {counts.boys} / {counts.girls}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">Гэр бүл</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
            {counts.families}
          </p>
        </div>
        <Stat
          label={`${month}-р сард төрсөн`}
          value={counts.birthdays}
          active={birthdays}
          onClick={() => setBirthdays((value) => !value)}
        />
      </div>

      {/* Давхардлын шалгалт — эхнэр нөхөр хоёулаа бүртгэсэн эсэх */}
      {(counts.merged > 0 || counts.possible > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-theme-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
          <p className="min-w-0 flex-1">
            {counts.merged > 0 && (
              <>
                <strong>{counts.merged}</strong> хүүхдийг хоёр хүн давхар
                бүртгэсэн — нэг мөр болгож нэгтгэсэн.{" "}
              </>
            )}
            {counts.possible > 0 && (
              <>
                <strong>{counts.possible}</strong> мөр нэр ижил ч төрсөн огноо
                зөрүүтэй эсвэл хоосон — нэг хүүхэд эсэхийг шалгана уу.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setDuplicatesOnly((value) => !value)}
            aria-pressed={duplicatesOnly}
            className="rounded-lg border border-warning-300 bg-white px-3 py-1.5 font-medium text-warning-800 hover:bg-warning-100 dark:border-warning-500/40 dark:bg-transparent dark:text-warning-300 dark:hover:bg-warning-500/10"
          >
            {duplicatesOnly ? "Бүгдийг харах" : "Давхардлыг харах"}
          </button>
        </div>
      )}

      {/* Насны бүлэг — дарж шүүнэ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ageGroups.map((item) => (
          <Stat
            key={item.key}
            label={item.label}
            value={counts.byGroup[item.key]}
            active={group === item.key}
            onClick={() => setGroup((value) => (value === item.key ? "" : item.key))}
          />
        ))}
        <Stat
          label="Нас тодорхойгүй"
          value={counts.byGroup.unknown}
          active={group === "unknown"}
          onClick={() => setGroup((value) => (value === "unknown" ? "" : "unknown"))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Хайх</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            strokeWidth={1.8}
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Хүүхэд эсвэл эцэг эхийн нэр, утас..."
            className={`${fieldClass} w-full pl-9`}
          />
        </label>

        <select
          value={gender}
          onChange={(event) => setGender(event.target.value)}
          aria-label="Хүйсээр шүүх"
          className={fieldClass}
        >
          <option value="">Хүйс</option>
          {genders.map((item) => (
            <option key={item.value} value={item.value}>
              {item.value === "male" ? "Хүү" : "Охин"}
            </option>
          ))}
        </select>

        <select
          value={aimag}
          onChange={(event) => setAimag(event.target.value)}
          aria-label="Эцэг эхийн аймгаар шүүх"
          className={fieldClass}
        >
          <option value="">Эцэг эхийн аймаг</option>
          {aimags.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.8} />
            Сэргээх
          </button>
          <ExportButton dataset="children" />
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      <div className="surface overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-left text-theme-sm">
          <thead>
            <tr className="border-b border-gray-200 text-theme-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">Хүүхэд</th>
              <th className="px-4 py-3 font-medium">Төрсөн өдөр</th>
              <th className="px-4 py-3 font-medium">Нас</th>
              <th className="px-4 py-3 font-medium">Эцэг эх</th>
              <th className="px-4 py-3 font-medium">Утас</th>
              <th className="px-4 py-3 font-medium">Аймаг</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  Ачаалж байна...
                </td>
              </tr>
            )}

            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  {all.length === 0
                    ? "Хүүхдийн бүртгэл алга. Хэрэглэгчид профайлынхаа «Гэр бүл» хэсэгт хүүхдээ нэмнэ."
                    : "Шүүлтүүрт тохирох хүүхэд алга."}
                </td>
              </tr>
            )}

            {visible.map((child) => {
              const parentAimags = [
                ...new Set(child.parents.flatMap((parent) => parent.aimags)),
              ];
              const birthdayNow = bornThisMonth(child.birthDate, month);

              return (
                <tr key={child.key} className="align-top hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {child.name || "Нэргүй"}
                    </p>
                    {child.duplicate === "merged" && (
                      <span className="mt-1 inline-block rounded-full bg-accent-50 px-2 py-0.5 text-theme-xs font-medium text-accent-700 dark:bg-accent-500/15 dark:text-accent-300">
                        {child.parents.length > 1
                          ? `${child.parents.length} хүн бүртгэсэн · нэгтгэсэн`
                          : "Давхар оруулсан · нэгтгэсэн"}
                      </span>
                    )}
                    {child.duplicate === "possible" && (
                      <span className="mt-1 inline-block rounded-full bg-warning-50 px-2 py-0.5 text-theme-xs font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-400">
                        Давхардсан байж магадгүй
                      </span>
                    )}
                    {child.gender && (
                      <p className="text-theme-xs text-gray-500">
                        {child.gender === "male" ? "Хүү" : child.gender === "female" ? "Охин" : labelOf(genders, child.gender)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    <span className="inline-flex items-center gap-1.5">
                      {child.birthDate || "—"}
                      {birthdayNow && (
                        <Cake
                          className="h-3.5 w-3.5 text-accent-500"
                          strokeWidth={2}
                          aria-label="Энэ сард төрсөн"
                        />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-700 dark:text-gray-300">
                    {child.age ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {child.parents.map((parent) => (
                      <Link
                        key={parent.uid}
                        href={`/users/directory/${encodeURIComponent(parent.uid)}`}
                        className="block text-gray-900 hover:text-accent-600 dark:text-white/90 dark:hover:text-accent-400"
                      >
                        {fullNameOf(parent) ?? parent.email}
                      </Link>
                    ))}
                    {child.parents.length === 1 && child.parents[0].spouse_name && (
                      <p className="text-theme-xs text-gray-500">
                        {child.parents[0].spouse_name}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {child.parents
                      .map((parent) => parent.phone)
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-gray-700 dark:text-gray-300">
                    {parentAimags.length
                      ? parentAimags.map((value) => labelOf(aimags, value)).join(", ")
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!loading && (
        <p className="text-theme-xs text-gray-400">
          {visible.length} / {all.length} хүүхэд харагдаж байна.
        </p>
      )}
    </div>
  );
}
