"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { MapPin, Plus, RefreshCw, X } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import { guardVisitStatusLabels } from "@/data/guardOptions";
import {
  deleteGuardPoint,
  listGuardPoints,
  type GuardPoint,
} from "@/lib/guardPoints";
import { isAdminRole } from "@/lib/permissions";

import GuardPointModal from "./GuardPointModal";
import GuardPointVisitModal from "./GuardPointVisitModal";

const shortDate = new Intl.DateTimeFormat("mn-MN", {
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
});

// Leaflet нь window-д шууд ханддаг тул зөвхөн browser дээр ачаална
const LeafletMap = dynamic(() => import("./GuardPointLeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center bg-gray-50 text-theme-sm text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
      Газрын зураг ачаалж байна...
    </div>
  ),
});

/**
 * Харуулын цэгүүдийн газрын зураг.
 *
 * Харуулын аймгийн гишүүд харна. Админ «Цэг нэмэх» горимд зураг дээр дарж
 * байршлаа сонгоод нэрийг нь бөглөнө.
 */
export default function GuardPointMap() {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);

  const [points, setPoints] = useState<GuardPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /** Зураг дээр дарж байршил сонгох горим */
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GuardPoint | null>(null);
  /** Эргэлтийн цонхонд нээгдсэн цэг */
  const [visiting, setVisiting] = useState<GuardPoint | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setPoints(await listGuardPoints());
    } catch (err) {
      console.error("Харуулын цэгүүдийг ачаалж чадсангүй:", err);
      setError("Цэгүүдийг ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePick = (lat: number, lng: number) => {
    setPicking(false);
    setPicked({ lat, lng });
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (point: GuardPoint) => {
    setPicked(null);
    setEditing(point);
    setFormOpen(true);
  };

  const handleDelete = async (point: GuardPoint) => {
    if (!window.confirm(`"${point.name}" цэгийг устгах уу?`)) return;

    setError("");

    try {
      await deleteGuardPoint(point.id);
      setPoints((prev) => prev.filter((item) => item.id !== point.id));
    } catch (err) {
      console.error("Устгахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    }
  };

  const activeCount = points.filter((point) => point.active).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <MapPin className="h-5 w-5 text-accent-600" strokeWidth={1.8} />
          Харуулын цэгүүд
          <span className="text-theme-sm font-normal text-gray-400">
            {activeCount} идэвхтэй
          </span>
        </h2>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            strokeWidth={1.8}
          />
          Сэргээх
        </button>

        {isAdmin &&
          (picking ? (
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="flex h-10 items-center gap-2 rounded-lg border border-accent-500 bg-accent-50 px-3.5 text-theme-sm font-medium text-accent-700 transition-colors hover:bg-accent-100 dark:border-accent-500 dark:bg-accent-500/10 dark:text-accent-400"
            >
              <X className="h-4 w-4" strokeWidth={2.2} />
              Сонголтыг болих
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-3.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              Цэг нэмэх
            </button>
          ))}
      </div>

      {picking && (
        <p className="rounded-lg bg-accent-50 px-4 py-3 text-theme-sm text-accent-700 dark:bg-accent-500/10 dark:text-accent-400">
          Харуулын цэг байрлах газар дээр газрын зургаас дарна уу.
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      <div className="surface overflow-hidden p-0">
        <LeafletMap
          points={points}
          picking={picking}
          onPick={handlePick}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onVisit={setVisiting}
          canManage={isAdmin}
        />
      </div>

      {!loading && !error && points.length === 0 && (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          {isAdmin
            ? "Цэг тэмдэглээгүй байна. «Цэг нэмэх» дарж зураг дээрээс сонгоно уу."
            : "Харуулын цэг хараахан тэмдэглэгдээгүй байна."}
        </p>
      )}

      {/* Цэгийн жагсаалт — зураггүй ч уншигдахуйц байх ёстой */}
      {points.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {points.map((point) => (
            <li
              key={point.id}
              className={`rounded-xl border p-3.5 ${
                point.active
                  ? "border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
                  : "border-dashed border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.02]"
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-theme-sm font-medium text-gray-900 dark:text-white">
                    {point.name}
                    {!point.active && (
                      <span className="ml-1.5 text-theme-xs font-normal text-gray-400">
                        · түр идэвхгүй
                      </span>
                    )}
                  </p>
                  {point.address && (
                    <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                      {point.address}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setVisiting(point)}
                  className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-theme-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  {isAdmin ? "Эргэлт" : "Түүх"}
                </button>
              </div>

              <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
                {point.lastVisit ? (
                  <>
                    Сүүлд {shortDate.format(point.lastVisit.visitedAt)} ·{" "}
                    {guardVisitStatusLabels[point.lastVisit.status]}
                  </>
                ) : (
                  "Хараахан эргээгүй"
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <GuardPointModal
        isOpen={isFormOpen}
        point={editing}
        picked={picked}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />

      <GuardPointVisitModal
        point={visiting}
        canRecord={isAdmin}
        onClose={() => setVisiting(null)}
        onRecorded={load}
      />
    </div>
  );
}
