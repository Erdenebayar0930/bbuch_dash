"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import ExportButton from "@/components/common/ExportButton";
import { scheduleConfigs, type ScheduleKind } from "@/data/scheduleOptions";
import { isAdminRole } from "@/lib/permissions";
import {
  deleteShift,
  listShifts,
  setShiftDone,
  type ScheduleShift,
} from "@/lib/schedule";
import { listUsers, type AppUser } from "@/lib/users";

import ScheduleShiftModal from "./ScheduleShiftModal";

const dayFormat = new Intl.DateTimeFormat("mn-MN", {
  month: "2-digit",
  day: "2-digit",
});

const weekdayFormat = new Intl.DateTimeFormat("mn-MN", { weekday: "short" });

const monthFormat = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "long",
});

/** YYYY-MM-DD → Date. Орон нутгийн шөнө дундаар — цагийн бүс өдрийг зөөхгүй. */
const parseDate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const pad = (value: number) => `${value}`.padStart(2, "0");

/** Тухайн сарын эхний ба сүүлийн өдрийг YYYY-MM-DD хэлбэрээр */
function monthRange(year: number, month: number) {
  const last = new Date(year, month + 1, 0).getDate();
  return {
    from: `${year}-${pad(month + 1)}-01`,
    to: `${year}-${pad(month + 1)}-${pad(last)}`,
  };
}

type ScheduleBoardProps = {
  kind: ScheduleKind;
};

/**
 * Ээлжийн хуваарь — сар тутмын жагсаалт.
 *
 * "Мод услах" ба "Дулаанхаан" хоёулаа энэ бүрэлдэхүүнийг ашиглана; ялгаа нь
 * зөвхөн баганын нэршил (scheduleConfigs). Агуу захирамжийн аймгийн гишүүд
 * харна; ээлж нэмэх/засах/устгах нь админы эрх; гүйцэтгэлээ хариуцагч өөрөө
 * тэмдэглэнэ.
 */
export default function ScheduleBoard({ kind }: ScheduleBoardProps) {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);
  const myUid = user?.uid ?? "";
  const config = scheduleConfigs[kind];

  /** Харагдаж буй сар — өнөөдрийн сараас эхэлнэ */
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [shifts, setShifts] = useState<ScheduleShift[]>([]);
  const [people, setPeople] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleShift | null>(null);

  const range = useMemo(
    () => monthRange(cursor.year, cursor.month),
    [cursor.year, cursor.month]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setShifts(await listShifts(kind, range));
    } catch (err) {
      console.error("Хуваарь ачаалж чадсангүй:", err);
      setError("Хуваарийг ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, [kind, range]);

  useEffect(() => {
    load();
  }, [load]);

  // Хариуцагч сонгох жагсаалтыг зөвхөн админ уншиж чадна
  useEffect(() => {
    if (!isAdmin) return;

    listUsers()
      .then((rows) => setPeople(rows.filter((row) => row.status === "active")))
      .catch((err) => console.error("Хэрэглэгчид уншихад алдаа гарлаа:", err));
  }, [isAdmin]);

  const shiftMonth = (step: number) => {
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month + step, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const done = shifts.filter((shift) => shift.doneAt).length;

  /** Энэ ээлжийг тухайн хэрэглэгч тэмдэглэж чадах эсэх */
  const canMark = (shift: ScheduleShift) =>
    isAdmin || shift.assignedTo === myUid;

  const handleToggle = async (shift: ScheduleShift) => {
    setBusyId(shift.id);
    setError("");

    try {
      const updated = await setShiftDone(shift.id, !shift.doneAt);
      setShifts((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err) {
      console.error("Тэмдэглэхэд алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Тэмдэглэж чадсангүй.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (shift: ScheduleShift) => {
    if (!window.confirm(`${shift.date}-ны ээлжийг устгах уу?`)) return;

    setBusyId(shift.id);
    setError("");

    try {
      await deleteShift(shift.id);
      setShifts((prev) => prev.filter((item) => item.id !== shift.id));
    } catch (err) {
      console.error("Устгахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    } finally {
      setBusyId(null);
    }
  };

  const buttonClass =
    "flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300";

  return (
    <div className="flex flex-col gap-5">
      {/* Сар сонгох ба тойм */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Өмнөх сар"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </button>

          <span className="min-w-[150px] px-2 text-center text-theme-sm font-medium text-gray-800 dark:text-white/90">
            {monthFormat.format(new Date(cursor.year, cursor.month, 1))}
          </span>

          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Дараах сар"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <span className="rounded-lg bg-gray-100 px-3 py-2 text-theme-sm text-gray-600 dark:bg-white/5 dark:text-gray-400">
          {done}/{shifts.length} ээлж {config.doneLabel.toLowerCase()}
        </span>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className={buttonClass}
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            strokeWidth={1.8}
          />
          Сэргээх
        </button>

        <ExportButton dataset={`schedule-${kind}`} />

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-3.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            Ээлж нэмэх
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-gray-200 text-theme-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
              <th className="px-5 py-3.5 font-medium">Огноо</th>
              <th className="px-5 py-3.5 font-medium">Хариуцагч</th>
              <th className="px-5 py-3.5 font-medium">{config.areaLabel}</th>
              <th className="px-5 py-3.5 font-medium">Тэмдэглэл</th>
              <th className="px-5 py-3.5 font-medium">Төлөв</th>
              <th className="px-5 py-3.5 text-right font-medium">Үйлдэл</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {loading && shifts.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-theme-sm text-gray-500"
                >
                  Ачаалж байна...
                </td>
              </tr>
            )}

            {!loading && shifts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <CalendarDays
                      className="h-9 w-9 text-gray-300 dark:text-gray-600"
                      strokeWidth={1.5}
                    />
                    <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                      Энэ сард ээлж бүртгэгдээгүй байна.
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {shifts.map((shift) => {
              const isDone = Boolean(shift.doneAt);

              return (
                <tr
                  key={shift.id}
                  className={`text-theme-sm transition-colors ${
                    busyId === shift.id ? "opacity-50" : ""
                  } ${isDone ? "bg-success-50 dark:bg-success-500/10" : ""}`}
                >
                  <td className="px-5 py-4">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {dayFormat.format(parseDate(shift.date))}
                    </span>
                    <span className="ml-1.5 text-theme-xs text-gray-400">
                      {weekdayFormat.format(parseDate(shift.date))}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                    {shift.assigneeName || (
                      <span className="text-gray-400">Хуваарилаагүй</span>
                    )}
                  </td>

                  <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                    {shift.area || "—"}
                  </td>

                  {/* Тэмдэглэл — урт бичвэрийг бүтнээр нь харуулна */}
                  <td className="max-w-[280px] whitespace-pre-line px-5 py-4 text-gray-600 dark:text-gray-400">
                    {shift.note || "—"}
                  </td>

                  <td className="px-5 py-4">
                    {/* Өнгө нь өөрөө мэдээлэл тул шошгыг нь ч бас бичнэ */}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-theme-xs font-medium ${
                        isDone
                          ? "bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400"
                          : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"
                      }`}
                    >
                      {isDone ? (
                        <>
                          <Check className="h-3 w-3" strokeWidth={3} />
                          {config.doneLabel}
                        </>
                      ) : (
                        "Хүлээгдэж буй"
                      )}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1.5">
                      {canMark(shift) && (
                        <button
                          type="button"
                          disabled={busyId === shift.id}
                          onClick={() => handleToggle(shift)}
                          title={
                            isDone
                              ? "Тэмдэглэгээг буцаах"
                              : `${config.doneLabel} гэж тэмдэглэх`
                          }
                          aria-label={
                            isDone
                              ? `${shift.date} — тэмдэглэгээг буцаах`
                              : `${shift.date} — ${config.doneLabel} гэж тэмдэглэх`
                          }
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-50 ${
                            isDone
                              ? "border-success-300 text-success-600 hover:bg-success-50 dark:border-success-500/30 dark:hover:bg-success-500/10"
                              : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
                          }`}
                        >
                          <Check className="h-4 w-4" strokeWidth={2.2} />
                        </button>
                      )}

                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(shift);
                              setFormOpen(true);
                            }}
                            aria-label={`${shift.date} — засах`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
                          >
                            <Pencil className="h-4 w-4" strokeWidth={1.8} />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === shift.id}
                            onClick={() => handleDelete(shift)}
                            aria-label={`${shift.date} — устгах`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-error-500 transition-colors hover:bg-error-50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-error-500/10"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ScheduleShiftModal
        isOpen={isFormOpen}
        kind={kind}
        shift={editing}
        people={people}
        defaultDate={range.from}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />
    </div>
  );
}