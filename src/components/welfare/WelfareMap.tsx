"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Crosshair, Loader2, MapPin, Plus, RefreshCw, X } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import ExportButton from "@/components/common/ExportButton";
import { getCurrentCoords } from "@/lib/geolocation";
import { isAdminRole } from "@/lib/permissions";
import {
  deleteHousehold,
  listHouseholds,
  type WelfareHousehold,
} from "@/lib/welfare";

import WelfareAidModal from "./WelfareAidModal";
import WelfareHouseholdModal from "./WelfareHouseholdModal";

const money = new Intl.NumberFormat("mn-MN");

const shortDate = new Intl.DateTimeFormat("mn-MN", {
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
});

// Leaflet нь window-д шууд ханддаг тул зөвхөн browser дээр ачаална
const LeafletMap = dynamic(() => import("./WelfareLeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center bg-gray-50 text-theme-sm text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
      Газрын зураг ачаалж байна...
    </div>
  ),
});

/**
 * Халамжийн үйлчлэлийн газрын зураг ба өрхийн жагсаалт.
 *
 * Уншихыг бүх хэрэглэгчид нээлттэй. Админ «Байршил нэмэх» горимд зураг дээр
 * дарж цэгээ сонгоод өрхийн мэдээллийг бөглөнө.
 */
export default function WelfareMap() {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);

  const [households, setHouseholds] = useState<WelfareHousehold[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /** Зураг дээр дарж байршил сонгох горим */
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WelfareHousehold | null>(null);
  /** Халамжийн цонхонд нээгдсэн өрх */
  const [aiding, setAiding] = useState<WelfareHousehold | null>(null);
  /** Хөтчөөс байршил уншиж байгаа эсэх */
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setHouseholds(await listHouseholds());
    } catch (err) {
      console.error("Халамжийн бүртгэл ачаалж чадсангүй:", err);
      setError("Бүртгэлийг ачаалахад алдаа гарлаа.");
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

  /**
   * Одоогийн байршлаар шинэ өрх нэмнэ — талбар дээр өрхийн хаалганы өмнө
   * зогсож байхад зургаас цэг хайх шаардлагагүй.
   */
  const handleUseMyLocation = async () => {
    setLocating(true);
    setError("");

    try {
      const coords = await getCurrentCoords();
      setPicking(false);
      handlePick(coords.lat, coords.lng);
    } catch (err) {
      console.error("Байршил тогтооход алдаа гарлаа:", err);
      setError(
        err instanceof Error ? err.message : "Байршлыг тогтоож чадсангүй."
      );
    } finally {
      setLocating(false);
    }
  };

  const handleEdit = (household: WelfareHousehold) => {
    setPicked(null);
    setEditing(household);
    setFormOpen(true);
  };

  const handleDelete = async (household: WelfareHousehold) => {
    if (
      !window.confirm(
        `"${household.name}" өрхийг халамжийн түүхтэй нь хамт устгах уу?`
      )
    ) {
      return;
    }

    setError("");

    try {
      await deleteHousehold(household.id);
      setHouseholds((prev) => prev.filter((item) => item.id !== household.id));
    } catch (err) {
      console.error("Устгахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    }
  };

  const activeCount = households.filter((item) => item.active).length;
  /** Нийт хамрагдсан хүний тоо — идэвхтэй өрхүүдээр */
  const peopleCount = households
    .filter((item) => item.active)
    .reduce((sum, item) => sum + item.familySize, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <MapPin className="h-5 w-5 text-accent-600" strokeWidth={1.8} />
          Хамрагдсан өрх
          <span className="text-theme-sm font-normal text-gray-400">
            {activeCount} өрх · {peopleCount} хүн
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

        <ExportButton dataset="welfare" />

        {/* Талбар дээрээс шууд бүртгэх зам — зургаас цэг хайхгүйгээр.
            Дэмжлэгийг рендерт шалгахгүй (hydration зөрнө) — дарсны дараа
            getCurrentCoords ойлгомжтой алдаа буцаана. */}
        {isAdmin && (
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={locating}
            title="Утасны GPS-ээр одоо байгаа цэгийг тогтооно"
            className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
            ) : (
              <Crosshair className="h-4 w-4" strokeWidth={1.8} />
            )}
            {locating ? "Тогтоож байна..." : "Одоогийн байршил"}
          </button>
        )}

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
          Өрх байрлаж буй цэг дээр газрын зургаас дарна уу.
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      <div className="surface overflow-hidden p-0">
        <LeafletMap
          households={households}
          picking={picking}
          onPick={handlePick}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAid={setAiding}
          canManage={isAdmin}
        />
      </div>

      {!loading && households.length === 0 && (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          {isAdmin
            ? "Өрх бүртгээгүй байна. «Байршил нэмэх» дарж зураг дээрээс сонгоно уу."
            : "Хамрагдсан өрх хараахан бүртгэгдээгүй байна."}
        </p>
      )}

      {/* Өрхийн жагсаалт — зураггүй ч уншигдахуйц байх ёстой */}
      {households.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {households.map((household) => (
            <li
              key={household.id}
              className={`rounded-xl border p-3.5 ${
                household.active
                  ? "border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
                  : "border-dashed border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.02]"
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-theme-sm font-medium text-gray-900 dark:text-white">
                    {household.name}
                    {!household.active && (
                      <span className="ml-1.5 text-theme-xs font-normal text-gray-400">
                        · түр гарсан
                      </span>
                    )}
                  </p>

                  <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                    {household.phone ? (
                      <a
                        href={`tel:${household.phone}`}
                        className="text-accent-600 hover:underline dark:text-accent-400"
                      >
                        {household.phone}
                      </a>
                    ) : (
                      "Утасгүй"
                    )}
                    {" · "}
                    {household.familySize || 0} хүн
                  </p>

                  {household.note && (
                    <p className="mt-1 line-clamp-2 text-theme-xs text-gray-500 dark:text-gray-400">
                      {household.note}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setAiding(household)}
                  className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-theme-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  {isAdmin ? "Халамж" : "Түүх"}
                </button>
              </div>

              <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
                {household.lastAid ? (
                  <>
                    Сүүлд {shortDate.format(household.lastAid.providedAt)} ·{" "}
                    {household.lastAid.description} · нийт{" "}
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {household.aidCount} удаа,{" "}
                      {money.format(household.totalAmount)}₮
                    </span>
                  </>
                ) : (
                  "Хараахан халамж үзүүлээгүй"
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <WelfareHouseholdModal
        isOpen={isFormOpen}
        household={editing}
        picked={picked}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />

      <WelfareAidModal
        household={aiding}
        canRecord={isAdmin}
        onClose={() => setAiding(null)}
        onRecorded={load}
      />
    </div>
  );
}