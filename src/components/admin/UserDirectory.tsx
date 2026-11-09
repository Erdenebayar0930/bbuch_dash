"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, RefreshCw, Search } from "lucide-react";

import ExportButton from "@/components/common/ExportButton";
import { aimags, genders, labelOf } from "@/data/profileOptions";
import {
  ageOf,
  fullNameOf,
  listDirectory,
  type DirectoryUser,
} from "@/lib/userDirectory";
import { statusLabels, type UserStatus } from "@/lib/users";

type Baptism = "all" | "water" | "holy" | "none";

const fieldClass =
  "h-10 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-800 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-gray-900 dark:text-white/90";

/** Хайлтад ашиглах текст — нэр, утас, имэйл, ажил, дуудлага */
const haystackOf = (user: DirectoryUser) =>
  [
    user.first_name,
    user.last_name,
    user.phone,
    user.email,
    user.occupation,
    user.ethnicity,
    user.birthplace,
    user.spouse_name,
    user.car_plate,
    ...user.callings,
  ]
    .join(" ")
    .toLowerCase();

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-theme-xs text-gray-400">{hint}</p>
      )}
    </div>
  );
}

/**
 * Хэрэглэгчдийн дэлгэрэнгүй мэдээллийн жагсаалт (зөвхөн админ).
 *
 * Дээд талын тоонууд нь ШҮҮСЭН жагсаалтаас тооцогдоно — жишээ нь аймгаар
 * шүүхэд тухайн аймгийн хүйс, баптисмын задаргаа гарна.
 */
export default function UserDirectory() {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [aimag, setAimag] = useState("");
  const [status, setStatus] = useState<"all" | UserStatus>("active");
  const [gender, setGender] = useState("");
  const [baptism, setBaptism] = useState<Baptism>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setUsers(await listDirectory());
    } catch (err) {
      console.error("Хэрэглэгчдийн мэдээллийг ачаалж чадсангүй:", err);
      setError("Хэрэглэгчдийн мэдээллийг ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return users.filter((user) => {
      if (status !== "all" && user.status !== status) return false;
      if (aimag && !user.aimags.includes(aimag)) return false;
      if (gender && user.gender !== gender) return false;
      if (baptism === "water" && !user.water_baptism_date) return false;
      if (baptism === "holy" && !user.holy_spirit_baptism_date) return false;
      if (
        baptism === "none" &&
        (user.water_baptism_date || user.holy_spirit_baptism_date)
      )
        return false;
      if (needle && !haystackOf(user).includes(needle)) return false;
      return true;
    });
  }, [users, query, aimag, status, gender, baptism]);

  const stats = useMemo(() => {
    const ages = visible
      .map((user) => ageOf(user.birth_date))
      .filter((age): age is number => age !== null);

    return {
      total: visible.length,
      male: visible.filter((u) => u.gender === "male").length,
      female: visible.filter((u) => u.gender === "female").length,
      water: visible.filter((u) => u.water_baptism_date).length,
      holy: visible.filter((u) => u.holy_spirit_baptism_date).length,
      avgAge: ages.length
        ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length)
        : null,
      agesKnown: ages.length,
      married: visible.filter((u) => u.spouse_name).length,
      children: visible.reduce((sum, u) => sum + u.children.length, 0),
    };
  }, [visible]);

  const filtersActive =
    query !== "" || aimag !== "" || status !== "active" || gender !== "" || baptism !== "all";

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Хүн" value={stats.total} />
        <Stat
          label="Эрэгтэй / Эмэгтэй"
          value={`${stats.male} / ${stats.female}`}
          hint={
            stats.total - stats.male - stats.female > 0
              ? `${stats.total - stats.male - stats.female} нь хүйсээ бөглөөгүй`
              : undefined
          }
        />
        <Stat label="Усан баптисм" value={stats.water} />
        <Stat label="Ариун Сүнсний баптисм" value={stats.holy} />
        <Stat
          label="Дундаж нас"
          value={stats.avgAge ?? "—"}
          hint={stats.agesKnown < stats.total ? `${stats.agesKnown} хүний огноогоор` : undefined}
        />
        <Stat
          label="Гэрлэсэн · Хүүхэд"
          value={`${stats.married} · ${stats.children}`}
        />
      </div>

      {/* Шүүлтүүр */}
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
            placeholder="Нэр, утас, имэйл, ажил, дуудлага..."
            className={`${fieldClass} w-full pl-9`}
          />
        </label>

        <select
          value={aimag}
          onChange={(event) => setAimag(event.target.value)}
          aria-label="Аймгаар шүүх"
          className={fieldClass}
        >
          <option value="">Бүх аймаг</option>
          {aimags.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as "all" | UserStatus)}
          aria-label="Төлөвөөр шүүх"
          className={fieldClass}
        >
          <option value="all">Бүх төлөв</option>
          {(Object.keys(statusLabels) as UserStatus[]).map((value) => (
            <option key={value} value={value}>
              {statusLabels[value]}
            </option>
          ))}
        </select>

        <select
          value={gender}
          onChange={(event) => setGender(event.target.value)}
          aria-label="Хүйсээр шүүх"
          className={fieldClass}
        >
          <option value="">Хүйс</option>
          {genders.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <select
          value={baptism}
          onChange={(event) => setBaptism(event.target.value as Baptism)}
          aria-label="Баптисмаар шүүх"
          className={fieldClass}
        >
          <option value="all">Баптисм</option>
          <option value="water">Усан баптисм авсан</option>
          <option value="holy">Ариун Сүнсний баптисм авсан</option>
          <option value="none">Баптисм аваагүй</option>
        </select>

        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setAimag("");
              setStatus("active");
              setGender("");
              setBaptism("all");
            }}
            className="h-10 rounded-lg px-3 text-theme-sm font-medium text-accent-600 hover:bg-accent-50 dark:text-accent-400 dark:hover:bg-accent-500/10"
          >
            Цэвэрлэх
          </button>
        )}

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
          <ExportButton dataset="users" />
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      <div className="surface overflow-x-auto p-0">
        <table className="w-full min-w-[1100px] text-left text-theme-sm">
          <thead>
            <tr className="border-b border-gray-200 text-theme-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">Хэрэглэгч</th>
              <th className="px-4 py-3 font-medium">Утас</th>
              <th className="px-4 py-3 font-medium">Нас</th>
              <th className="px-4 py-3 font-medium">Аймаг · Дуудлага</th>
              <th className="px-4 py-3 font-medium">Баптисм</th>
              <th className="px-4 py-3 font-medium">MBTI</th>
              <th className="px-4 py-3 font-medium">Ажил</th>
              <th className="px-4 py-3 font-medium">Гэр бүл</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Тайлан</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {loading && users.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                  Ачаалж байна...
                </td>
              </tr>
            )}

            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                  Шүүлтүүрт тохирох хэрэглэгч алга.
                </td>
              </tr>
            )}

            {visible.map((user) => {
              const age = ageOf(user.birth_date);
              const href = `/users/directory/${encodeURIComponent(user.uid)}`;

              return (
                <tr key={user.uid} className="align-top hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={href} className="font-medium text-gray-900 hover:text-accent-600 dark:text-white dark:hover:text-accent-400">
                      {fullNameOf(user) ?? "Нэр оруулаагүй"}
                    </Link>
                    <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                      {user.email}
                    </p>
                    {user.status !== "active" && (
                      <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-theme-xs text-gray-500 dark:bg-white/5">
                        {statusLabels[user.status]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {user.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {age ?? "—"}
                    {user.gender && (
                      <p className="text-theme-xs text-gray-500">
                        {labelOf(genders, user.gender)}
                      </p>
                    )}
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-gray-700 dark:text-gray-300">
                    {user.aimags.length
                      ? user.aimags.map((value) => labelOf(aimags, value)).join(", ")
                      : "—"}
                    {user.callings.length > 0 && (
                      <p className="text-theme-xs text-gray-500">
                        {user.callings.join(", ")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-theme-xs text-gray-600 dark:text-gray-400">
                    <p>Ус: {user.water_baptism_date || "—"}</p>
                    <p>Ариун Сүнс: {user.holy_spirit_baptism_date || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {user.mbti || "—"}
                  </td>
                  <td className="max-w-[180px] px-4 py-3 text-gray-700 dark:text-gray-300">
                    {user.occupation || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {user.spouse_name || "—"}
                    {user.children.length > 0 && (
                      <p className="text-theme-xs text-gray-500">
                        {user.children.length} хүүхэд
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={href}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-theme-xs font-medium text-accent-600 hover:bg-accent-50 dark:text-accent-400 dark:hover:bg-accent-500/10"
                    >
                      Тайлан
                      <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!loading && (
        <p className="text-theme-xs text-gray-400">
          {visible.length} / {users.length} хэрэглэгч харагдаж байна.
        </p>
      )}
    </div>
  );
}
