"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

import {
  addGivingPerson,
  loadGiving,
  removeGivingPerson,
  setGivingMark,
  type GivingBoard,
  type GivingPerson,
} from "@/lib/giving";
import { listUsers, type AppUser } from "@/lib/users";

type GivingTrackerProps = {
  board: GivingBoard;
  /** Чагтлах боломжгүй — зөвхөн харна */
  readOnly?: boolean;
  /** Хүн нэмэх, хасах боломжтой (админ) */
  canManage?: boolean;
};

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

const monthKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

/** Улаанбаатарын одоогийн он, сар */
function nowInUlaanbaatar() {
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .split("-")
    .map(Number);
  return { year, month };
}

const fieldClass =
  "h-10 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90";

/**
 * «Өргөж буй байдал» — нэрс × сарууд. Админ сар бүр өргөсөн эсэхийг чагтална.
 * Хүнийг системийн хэрэглэгчээс сонгох эсвэл чөлөөт нэрээр нэмнэ.
 * (Энэ хэсэг зөвхөн админд харагдана — API ч `requireAdmin`.)
 */
export default function GivingTracker({
  board,
  readOnly = false,
  canManage = true,
}: GivingTrackerProps) {
  // Сахилгажуулалт бол «төлсөн», бусад нь «өргөсөн»
  const isDiscipline = board === "discipline";
  const doneWord = isDiscipline ? "төлсөн" : "өргөсөн";
  const notDoneWord = isDiscipline ? "төлөөгүй" : "өргөөгүй";
  const now = useMemo(() => nowInUlaanbaatar(), []);
  const [year, setYear] = useState(now.year);

  const [people, setPeople] = useState<GivingPerson[]>([]);
  const [marks, setMarks] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [mode, setMode] = useState<"user" | "name">("user");
  const [pickedUid, setPickedUid] = useState("");
  const [freeName, setFreeName] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadGiving(board, year);
      setPeople(data.people);
      setMarks(data.marks);
    } catch (err) {
      console.error("Өргөлийн бүртгэл ачаалж чадсангүй:", err);
      setError(err instanceof Error ? err.message : "Ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, [board, year]);

  useEffect(() => {
    load();
  }, [load]);

  // Хэрэглэгч сонгох жагсаалт — нэг удаа (нэмэх эрхтэйд л)
  useEffect(() => {
    if (!canManage) return;
    listUsers()
      .then((rows) =>
        setUsers(
          rows
            .filter((user) => user.status === "active")
            .sort((a, b) =>
              `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, "mn")
            )
        )
      )
      .catch((err) => console.error("Хэрэглэгчдийг уншиж чадсангүй:", err));
  }, [canManage]);

  const listedUids = useMemo(
    () => new Set(people.map((person) => person.uid).filter(Boolean)),
    [people]
  );
  const userChoices = users.filter((user) => !listedUids.has(user.uid));

  const toggle = async (person: GivingPerson, month: number) => {
    if (readOnly) return;
    const key = monthKey(year, month);
    const given = !(marks.get(person.id)?.has(key) ?? false);

    const apply = (value: boolean) =>
      setMarks((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(person.id) ?? []);
        if (value) set.add(key);
        else set.delete(key);
        next.set(person.id, set);
        return next;
      });

    // Шууд харуулна — алдаа гарвал буцаана
    apply(given);
    try {
      await setGivingMark(person.id, key, given);
    } catch (err) {
      apply(!given);
      setError(err instanceof Error ? err.message : "Тэмдэглэхэд алдаа гарлаа.");
    }
  };

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload =
      mode === "user"
        ? pickedUid
          ? { uid: pickedUid }
          : null
        : freeName.trim()
          ? { name: freeName.trim() }
          : null;
    if (!payload) return;

    setAdding(true);
    setError(null);
    try {
      await addGivingPerson(board, payload);
      setPickedUid("");
      setFreeName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Нэмэхэд алдаа гарлаа.");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (person: GivingPerson) => {
    if (!window.confirm(`«${person.name}»-ийг жагсаалтаас хасах уу? Тэмдэглэгээ нь хамт устна.`)) {
      return;
    }
    try {
      await removeGivingPerson(person.id);
      setPeople((prev) => prev.filter((item) => item.id !== person.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хасахад алдаа гарлаа.");
    }
  };

  const monthTotals = MONTHS.map(
    (month) =>
      people.filter((person) => marks.get(person.id)?.has(monthKey(year, month))).length
  );

  return (
    <div className="surface flex flex-col gap-4 p-4 sm:p-5">
      {/* Жил ба хүн нэмэх */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setYear((value) => value - 1)}
            aria-label="Өмнөх жил"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </button>
          <span className="min-w-[4.5rem] text-center text-base font-semibold text-gray-900 dark:text-white">
            {year} он
          </span>
          <button
            type="button"
            onClick={() => setYear((value) => value + 1)}
            aria-label="Дараах жил"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {canManage && (
        <form onSubmit={add} className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 p-0.5 text-theme-xs dark:border-white/10">
            {(
              [
                ["user", "Хэрэглэгчээс"],
                ["name", "Нэр бичих"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  mode === value
                    ? "bg-accent-600 text-white"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "user" ? (
            <select
              value={pickedUid}
              onChange={(event) => setPickedUid(event.target.value)}
              aria-label="Хэрэглэгч сонгох"
              className={`${fieldClass} min-w-[200px]`}
            >
              <option value="">Хэрэглэгч сонгох</option>
              {userChoices.map((user) => (
                <option key={user.uid} value={user.uid}>
                  {[user.last_name, user.first_name].filter(Boolean).join(" ") || user.email}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={freeName}
              onChange={(event) => setFreeName(event.target.value)}
              placeholder="Овог нэр"
              maxLength={255}
              aria-label="Нэр"
              className={`${fieldClass} min-w-[200px]`}
            />
          )}

          <button
            type="submit"
            disabled={adding || (mode === "user" ? !pickedUid : !freeName.trim())}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent-600 px-3.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            Нэмэх
          </button>
        </form>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      {loading && people.length === 0 ? (
        <p className="py-8 text-center text-theme-sm text-gray-500">Ачаалж байна...</p>
      ) : people.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-theme-sm text-gray-400 dark:border-white/10">
          Жагсаалт хоосон байна. Дээрээс хүн нэмнэ үү.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
          <table className="w-full min-w-[760px] border-collapse text-theme-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-white/[0.03]">
                <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5 text-left font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  Нэр
                </th>
                {MONTHS.map((month) => {
                  const current = year === now.year && month === now.month;
                  return (
                    <th
                      key={month}
                      className={`px-1 py-2.5 text-center text-theme-xs font-semibold ${
                        current ? "text-accent-700 dark:text-accent-300" : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {month}-р сар
                    </th>
                  );
                })}
                <th className="px-2 py-2.5 text-center text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
                  Нийт
                </th>
                <th className="w-10" aria-label="Үйлдэл" />
              </tr>
            </thead>

            <tbody>
              {people.map((person) => {
                const given = marks.get(person.id) ?? new Set<string>();
                const count = MONTHS.filter((month) => given.has(monthKey(year, month))).length;

                return (
                  <tr key={person.id} className="border-t border-gray-100 dark:border-white/5">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-gray-900 dark:bg-gray-900 dark:text-white">
                      <span className="block max-w-[220px] truncate" title={person.name}>
                        {person.name}
                      </span>
                      {!person.uid && (
                        <span className="text-theme-xs font-normal text-gray-400">
                          Системд бүртгэлгүй
                        </span>
                      )}
                      {person.inAimag && (
                        <span className="text-theme-xs font-normal text-gray-400">
                          Хангамжийн аймаг
                        </span>
                      )}
                    </td>

                    {MONTHS.map((month) => {
                      const key = monthKey(year, month);
                      const checked = given.has(key);
                      return (
                        <td key={month} className="px-1 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(person, month)}
                            disabled={readOnly}
                            aria-label={`${person.name} — ${year} оны ${month}-р сар ${checked ? doneWord : notDoneWord}`}
                            className="h-5 w-5 cursor-pointer accent-success-600 disabled:cursor-default"
                          />
                        </td>
                      );
                    })}

                    <td className="px-2 py-2 text-center text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
                      {count}/12
                    </td>
                    <td className="px-1 py-2 text-center">
                      {/* Аймгийн гишүүн хасагдвал дахин автоматаар орох тул товчгүй */}
                      {canManage && !person.inAimag && (
                      <button
                        type="button"
                        onClick={() => remove(person)}
                        aria-label={`«${person.name}»-ийг хасах`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.03]">
                <td className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-theme-xs font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                  {isDiscipline ? "Төлсөн хүн" : "Өргөсөн хүн"}
                </td>
                {monthTotals.map((total, index) => (
                  <td
                    key={index}
                    className="px-1 py-2 text-center text-theme-xs font-semibold text-gray-600 dark:text-gray-400"
                  >
                    {total}
                  </td>
                ))}
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
