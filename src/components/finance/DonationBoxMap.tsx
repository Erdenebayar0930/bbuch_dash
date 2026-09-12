"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { MapPin, Plus, RefreshCw, X } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import ExportButton from "@/components/common/ExportButton";
import { visitStatusLabels } from "@/data/donationBoxOptions";
import {
  deleteDonationBox,
  listDonationBoxes,
  type DonationBox,
} from "@/lib/donationBoxes";
import { isAdminRole } from "@/lib/permissions";

import DonationBoxModal from "./DonationBoxModal";
import DonationBoxVisitModal from "./DonationBoxVisitModal";

const money = new Intl.NumberFormat("mn-MN");

const shortDate = new Intl.DateTimeFormat("mn-MN", {
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
});

// Leaflet нь window-д шууд ханддаг тул зөвхөн browser дээр ачаална
const LeafletMap = dynamic(() => import("./DonationBoxLeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center bg-gray-50 text-theme-sm text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
      Газрын зураг ачаалж байна...
    </div>
  ),
});

/**
 * Хандивын хайрцгууд байрлаж буй газрын зураг.
 *
 * Туслах үйлчлэх аймгийн гишүүд харна. Админ «Байршил нэмэх» горимд зураг дээр
 * дарж цэгээ сонгоод нэрийг нь бөглөнө — координатыг гараар олох шаардлагагүй.
 */
export default function DonationBoxMap() {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);

  const [boxes, setBoxes] = useState<DonationBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /** Зураг дээр дарж байршил сонгох горим */
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DonationBox | null>(null);
  /** Эргэлтийн цонхонд нээгдсэн хайрцаг */
  const [visiting, setVisiting] = useState<DonationBox | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setBoxes(await listDonationBoxes());
    } catch (err) {
      console.error("Хайрцгийн байршил ачаалж чадсангүй:", err);
      setError("Байршлыг ачаалахад алдаа гарлаа.");
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

  const handleEdit = (box: DonationBox) => {
    setPicked(null);
    setEditing(box);
    setFormOpen(true);
  };

  const handleDelete = async (box: DonationBox) => {
    if (!window.confirm(`"${box.name}" байршлыг устгах уу?`)) return;

    setError("");

    try {
      await deleteDonationBox(box.id);
      setBoxes((prev) => prev.filter((item) => item.id !== box.id));
    } catch (err) {
      console.error("Устгахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    }
  };

  const activeCount = boxes.filter((box) => box.active).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <MapPin className="h-5 w-5 text-accent-600" strokeWidth={1.8} />
          Хайрцгийн байршил
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

        <ExportButton dataset="donation-boxes" />

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
              Байршил нэмэх
            </button>
          ))}
      </div>

      {picking && (
        <p className="rounded-lg bg-accent-50 px-4 py-3 text-theme-sm text-accent-700 dark:bg-accent-500/10 dark:text-accent-400">
          Хайрцаг байрлаж буй цэг дээр газрын зургаас дарна уу.
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      <div className="surface overflow-hidden p-0">
        <LeafletMap
          boxes={boxes}
          picking={picking}
          onPick={handlePick}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onVisit={setVisiting}
          canManage={isAdmin}
        />
      </div>

      {!loading && boxes.length === 0 && (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          {isAdmin
            ? "Байршил тэмдэглээгүй байна. «Байршил нэмэх» дарж зураг дээрээс сонгоно уу."
            : "Хайрцгийн байршил хараахан тэмдэглэгдээгүй байна."}
        </p>
      )}

      {/* Хайрцгийн жагсаалт — зураггүй ч уншигдахуйц байх ёстой */}
      {boxes.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {boxes.map((box) => (
            <li
              key={box.id}
              className={`rounded-xl border p-3.5 ${
                box.active
                  ? "border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
                  : "border-dashed border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.02]"
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-theme-sm font-medium text-gray-900 dark:text-white">
                    {box.name}
                    {!box.active && (
                      <span className="ml-1.5 text-theme-xs font-normal text-gray-400">
                        · түр хураагдсан
                      </span>
                    )}
                  </p>
                  {box.address && (
                    <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                      {box.address}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setVisiting(box)}
                  className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-theme-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  {isAdmin ? "Эргэлт" : "Түүх"}
                </button>
              </div>

              <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
                {box.lastVisit ? (
                  <>
                    Сүүлд {shortDate.format(box.lastVisit.visitedAt)} ·{" "}
                    {visitStatusLabels[box.lastVisit.status]} · нийт{" "}
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {money.format(box.totalCollected)}₮
                    </span>
                    {" · "}
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {money.format(box.totalClothing)} ш
                    </span>{" "}
                    хувцас
                  </>
                ) : (
                  "Хараахан эргээгүй"
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <DonationBoxModal
        isOpen={isFormOpen}
        box={editing}
        picked={picked}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />

      <DonationBoxVisitModal
        box={visiting}
        canRecord={isAdmin}
        onClose={() => setVisiting(null)}
        onRecorded={load}
      />
    </div>
  );
}