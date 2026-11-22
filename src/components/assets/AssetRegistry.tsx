"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Check,
  ChevronRight,
  ClipboardCheck,
  Eye,
  ListChecks,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
} from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import ExportButton from "@/components/common/ExportButton";
import {
  assetStateLabels,
  assetStateStyles,
  assetStates,
  type AssetState,
} from "@/data/assetStates";
import { aimags, labelOf } from "@/data/profileOptions";
import { canManageCoding, isAdminRole } from "@/lib/permissions";
import {
  checkStatusLabels,
  deleteAsset,
  finishCount,
  getAssetMeta,
  getCountState,
  listAssets,
  startCount,
  type Asset,
  type CheckStatus,
  type CountState,
  type RefItem,
} from "@/lib/assets";

import AssetCheckModal from "./AssetCheckModal";
import AssetFormModal from "./AssetFormModal";
import AssetViewModal from "./AssetViewModal";
import MetaManagerModal from "./MetaManagerModal";
import { dateFormat } from "@/lib/dateFormat";

const checkStyles: Record<CheckStatus, string> = {
  ok: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  damaged:
    "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  short:
    "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  missing: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
};

const shortDate = dateFormat;

/** "Бүгд" сонголтын түлхүүр — хоосон мөр нь "оноогоогүй"-г заана */
const ALL = "__all__";
const NONE = "__none__";

type AssetRegistryProps = {
  /**
   * Аймгийн түлхүүр — өгвөл зөвхөн тухайн аймгийн хөрөнгө харагдана, шинээр
   * бүртгэсэн нь ч мөн тэр аймагт хамаарна. Өгөхгүй бол бүх бүртгэл.
   */
  aimag?: string;
  /**
   * Аль цэсийн харагдац вэ (@see ASSET_VIEWS) — тухайн ангиллуудын хөрөнгийг
   * л харуулна. Өгөхгүй бол бүх ангилал, байршлын карттай.
   */
  view?: AssetView;
};

export type AssetView = "general" | "written_off" | "warehouse" | "usage";

/**
 * Цэс бүрийн харагдац — ямар ангиллын хөрөнгө харуулах вэ. Агуулах тус
 * бүрийн карт бүх харагдацад байна (тухайн ангиллын тоогоор).
 *
 * • Ерөнхий бүртгэл — акталснаас бусад бүх хөрөнгө
 * • Акталсан хөрөнгийн бүртгэл — зөвхөн акталсан
 * • Агуулахын бүртгэл — акталснаас бусад
 * • Ашиглалтын байдал — ашиглалтад ба засварт байгаа
 */
const ASSET_VIEWS: Record<AssetView, AssetState[]> = {
  general: ["registered", "repair", "in_use"],
  written_off: ["written_off"],
  warehouse: ["registered", "repair", "in_use"],
  usage: ["in_use", "repair"],
};

export default function AssetRegistry({ aimag, view }: AssetRegistryProps) {
  const viewStates = view ? ASSET_VIEWS[view] : assetStates;
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);
  // Агуулах/төрлийн лавлах жагсаалтыг админ болон тухайн аймгийн гишүүд
  // (жишээ нь Магтаалын аймаг) удирдана.
  const canManageMeta =
    isAdmin || (!!aimag && (user?.aimags ?? []).includes(aimag));
  /** Байршил / Төрөл / Нэрийн жагсаалт — Кодчилол удирдах эрхтэй хүн (админ олгоно) */
  const canCoding = canManageCoding(user?.role, user?.can_code);
  /**
   * Бүртгэл нэмэх, засах, шалгалт бүртгэх — админ эсвэл тухайн аймгийн
   * гишүүн (Магтаал). Устгах нь зөвхөн админд.
   */
  const canEdit = canManageMeta;
  /** Аймгийн хуудсанд аймаг нь тогтмол тул баганаар давтаж харуулах утгагүй */
  const columnCount = aimag ? 6 : 7;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [warehouses, setWarehouses] = useState<RefItem[]>([]);
  const [categories, setCategories] = useState<RefItem[]>([]);
  const [names, setNames] = useState<RefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [warehouseFilter, setWarehouseFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  /** Ангиллын таб — ALL эсвэл AssetState */
  const [stateFilter, setStateFilter] = useState<AssetState | typeof ALL>(ALL);
  const [query, setQuery] = useState("");

  /** Идэвхтэй тооллого ба түүний явцад тоологдсон хөрөнгүүд */
  const [count, setCount] = useState<CountState>({
    session: null,
    checkedAssetIds: new Set(),
  });
  /** Тооллогын үед — зөвхөн тоологдоогүйг харуулах */
  const [onlyUncounted, setOnlyUncounted] = useState(false);
  const [countBusy, setCountBusy] = useState(false);

  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [isMetaOpen, setMetaOpen] = useState(false);
  /** Зөвхөн харах цонхонд нээгдсэн бүртгэл */
  const [viewing, setViewing] = useState<Asset | null>(null);
  const [checking, setChecking] = useState<Asset | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [assetRows, meta, countState] = await Promise.all([
        listAssets(aimag),
        getAssetMeta(),
        getCountState(),
      ]);
      setAssets(assetRows);
      setWarehouses(meta.warehouses);
      setCategories(meta.categories);
      setNames(meta.names);
      setCount(countState);
    } catch (err) {
      console.error("Эд хөрөнгө ачаалж чадсангүй:", err);
      setError("Бүртгэлийг ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, [aimag]);

  useEffect(() => {
    load();
  }, [load]);

  /** Кодчилол — маягт дараагийн кодыг тооцоход (акталсных ч эзэлсэн) */
  const assetCodes = useMemo(() => assets.map((asset) => asset.code).filter(Boolean), [assets]);

  /** Энэ цэсийн ангиллуудад багтах хөрөнгө */
  const scoped = useMemo(
    () => assets.filter((asset) => viewStates.includes(asset.state)),
    [assets, viewStates]
  );

  /** Сонгосон байршлын хөрөнгө — ангиллын табын тоо үүнээс тоологдоно */
  const inWarehouse = useMemo(
    () =>
      scoped.filter((asset) =>
        warehouseFilter === ALL
          ? true
          : warehouseFilter === NONE
            ? asset.warehouseId === null
            : asset.warehouseId === warehouseFilter
      ),
    [scoped, warehouseFilter]
  );

  const stateCounts = useMemo(() => {
    const counts = Object.fromEntries(assetStates.map((state) => [state, 0])) as Record<
      AssetState,
      number
    >;
    for (const asset of inWarehouse) counts[asset.state] += 1;
    return counts;
  }, [inWarehouse]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return inWarehouse.filter((asset) => {
      if (stateFilter !== ALL && asset.state !== stateFilter) return false;
      // Тооллогын үед аль хэдийн тоологдсоныг нуух сонголт
      if (onlyUncounted && count.checkedAssetIds.has(asset.id)) return false;

      if (categoryFilter === NONE && asset.categoryId !== null) return false;
      if (
        categoryFilter !== ALL &&
        categoryFilter !== NONE &&
        asset.categoryId !== categoryFilter
      ) {
        return false;
      }

      if (!needle) return true;

      return [asset.name, asset.code, asset.note]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [inWarehouse, stateFilter, categoryFilter, query, onlyUncounted, count]);

  /**
   * Төрлөөр бүлэглэнэ — жишээ нь «Аяга» бүлэгт аяга тус бүр (тусдаа эд
   * хөрөнгө, өөрийн кодтой). Бүлэг нэрээр, ширхэг нь кодоор эрэмбэлэгдэнэ.
   */
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; assets: Asset[] }>();
    for (const asset of visible) {
      const key = asset.categoryId ?? NONE;
      const group = map.get(key) ?? { key, name: asset.categoryName ?? "Төрөл оноогоогүй", assets: [] };
      group.assets.push(asset);
      map.set(key, group);
    }
    const byCode = (a: Asset, b: Asset) =>
      a.code.localeCompare(b.code, undefined, { numeric: true }) || a.name.localeCompare(b.name);
    return [...map.values()]
      .map((group) => ({ ...group, assets: [...group.assets].sort(byCode) }))
      .sort((a, b) => (a.key === NONE ? 1 : b.key === NONE ? -1 : a.name.localeCompare(b.name)));
  }, [visible]);

  /** Хумьсан бүлгүүд — анхдагчаар бүгд задгай */
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /** Тооллогын явц — бүртгэлийн нийт мөрөөс хэд нь тоологдсон бэ */
  const counted = useMemo(
    () => assets.filter((asset) => count.checkedAssetIds.has(asset.id)).length,
    [assets, count]
  );

  const handleStartCount = async () => {
    setCountBusy(true);
    setError("");

    try {
      setCount(await startCount());
      setOnlyUncounted(false);
    } catch (err) {
      console.error("Тооллого эхлүүлэхэд алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Тооллого эхлүүлж чадсангүй.");
    } finally {
      setCountBusy(false);
    }
  };

  const handleFinishCount = async () => {
    if (
      !window.confirm(
        `Тооллогыг дуусгах уу? ${assets.length - counted} хөрөнгө тоологдоогүй байна.`
      )
    ) {
      return;
    }

    setCountBusy(true);
    setError("");

    try {
      await finishCount();
      setCount({ session: null, checkedAssetIds: new Set() });
      setOnlyUncounted(false);
    } catch (err) {
      console.error("Тооллого дуусгахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Тооллого дуусгаж чадсангүй.");
    } finally {
      setCountBusy(false);
    }
  };

  /** Агуулах тус бүрийн нийт нэр төрөл ба ангилал тус бүрийн тоо — дээд талын тойм */
  const perWarehouse = useMemo(() => {
    return warehouses.map((warehouse) => {
      const own = scoped.filter((asset) => asset.warehouseId === warehouse.id);
      return {
        ...warehouse,
        count: own.length,
        states: viewStates
          .map((state) => ({ state, count: own.filter((asset) => asset.state === state).length }))
          .filter((item) => item.count > 0),
      };
    });
  }, [scoped, warehouses, viewStates]);

  const handleDelete = async (asset: Asset) => {
    setRemovingId(asset.id);
    setError("");

    try {
      await deleteAsset(asset.id);
      setAssets((prev) => prev.filter((item) => item.id !== asset.id));
    } catch (err) {
      console.error("Устгахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    } finally {
      setRemovingId(null);
    }
  };

  const selectClass =
    "h-10 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-800 transition-colors focus:border-accent-400 focus:outline-hidden dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90";

  return (
    <div className="flex flex-col gap-5">
      {/* Агуулах тус бүрийн тойм — бүх харагдацад */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {perWarehouse.map((warehouse) => (
          <button
            key={warehouse.id}
            type="button"
            onClick={() =>
              setWarehouseFilter((prev) =>
                prev === warehouse.id ? ALL : warehouse.id
              )
            }
            className={`rounded-xl border p-4 text-left transition-colors ${
              warehouseFilter === warehouse.id
                ? "border-accent-500 bg-accent-50/60 dark:border-accent-500 dark:bg-accent-500/10"
                : "border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
            }`}
          >
            <span className="block truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
              {warehouse.name}
            </span>
            <span className="mt-1 block text-theme-xs text-gray-500 dark:text-gray-400">
              {warehouse.count} нэр төрөл
            </span>
            {warehouse.states.length > 0 && (
              <span className="mt-2 flex flex-wrap gap-1">
                {warehouse.states.map((item) => (
                  <span
                    key={item.state}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${assetStateStyles[item.state]}`}
                  >
                    {assetStateLabels[item.state]} {item.count}
                  </span>
                ))}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Ангилал — сонгосон байршлын (эсвэл бүх) хөрөнгийг бүлэглэнэ. Ганц
          ангилалтай цэсэнд (Акталсан) таб хэрэггүй. */}
      {viewStates.length > 1 && (
      <div
        role="tablist"
        aria-label="Ангилал"
        className="flex gap-x-1 overflow-x-auto overflow-y-hidden no-scrollbar border-b border-gray-200 dark:border-white/10"
      >
        {([ALL, ...viewStates] as const).map((key) => {
          const selected = stateFilter === key;
          const label = key === ALL ? "Бүгд" : assetStateLabels[key];
          const total = key === ALL ? inWarehouse.length : stateCounts[key];
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setStateFilter(key)}
              className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-theme-sm font-medium transition-colors ${
                selected
                  ? "border-accent-600 text-accent-700 dark:border-accent-400 dark:text-accent-300"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {label}
              <span className="rounded-full bg-gray-100 px-1.5 text-theme-xs text-gray-500 dark:bg-white/10 dark:text-gray-400">
                {total}
              </span>
            </button>
          );
        })}
      </div>
      )}

      {/* Шүүлтүүр ба үйлдэл */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Нэр, код, тэмдэглэлээр хайх"
          className="h-10 min-w-[200px] flex-1 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
        />

        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          aria-label="Төрлөөр шүүх"
          className={selectClass}
        >
          <option value={ALL}>Бүх төрөл</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
          <option value={NONE}>Төрөл оноогоогүй</option>
        </select>

        <select
          value={warehouseFilter}
          onChange={(event) => setWarehouseFilter(event.target.value)}
          aria-label="Байршлын ангиллаар шүүх"
          className={selectClass}
        >
          <option value={ALL}>Бүх байршил</option>
          {warehouses.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
          <option value={NONE}>Байршил оноогоогүй</option>
        </select>

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

        <ExportButton dataset="assets" />

        {canManageMeta && !count.session && (
          <button
            type="button"
            onClick={handleStartCount}
            disabled={countBusy || loading}
            className="flex h-10 items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-3.5 text-theme-sm font-medium text-success-700 transition-colors hover:bg-success-100 disabled:opacity-60 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400 dark:hover:bg-success-500/20"
          >
            <ListChecks className="h-4 w-4" strokeWidth={1.8} />
            Тооллого эхлүүлэх
          </button>
        )}

        {/* Агуулах, төрлийн жагсаалтыг админ болон тухайн аймгийн гишүүд тохируулна */}
        {canCoding && (
          <button
            type="button"
            onClick={() => setMetaOpen(true)}
            className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            <Settings2 className="h-4 w-4" strokeWidth={1.8} />
            Байршил / төрөл
          </button>
        )}

        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-3.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              Бүртгэх
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      {/* Тооллого явж байх үеийн явцын самбар */}
      {count.session && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-success-200 bg-success-50 p-4 dark:border-success-500/30 dark:bg-success-500/10">
          <ListChecks
            className="h-5 w-5 shrink-0 text-success-600 dark:text-success-400"
            strokeWidth={1.8}
          />

          <div className="min-w-[180px] flex-1">
            <p className="text-theme-sm font-medium text-success-800 dark:text-success-300">
              Тооллого явагдаж байна
            </p>
            <p className="mt-0.5 text-theme-xs text-success-700/80 dark:text-success-400/80">
              {shortDate.format(count.session.startedAt)}-нд эхэлсэн ·{" "}
              {counted}/{assets.length}{" "}
              {aimag ? "энэ аймгийн хөрөнгө" : "хөрөнгө"} тоологдсон
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-success-200/70 dark:bg-success-500/20">
              <div
                className="h-full rounded-full bg-success-500 transition-all"
                style={{
                  width: `${assets.length ? (counted / assets.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOnlyUncounted((prev) => !prev)}
            className={`flex h-10 items-center gap-2 rounded-lg border px-3.5 text-theme-sm font-medium transition-colors ${
              onlyUncounted
                ? "border-success-500 bg-white text-success-700 dark:border-success-500 dark:bg-white/10 dark:text-success-300"
                : "border-success-200 bg-white/60 text-success-700 hover:bg-white dark:border-success-500/30 dark:bg-white/5 dark:text-success-300"
            }`}
          >
            Зөвхөн тоологдоогүй
          </button>

          {canManageMeta && (
            <button
              type="button"
              onClick={handleFinishCount}
              disabled={countBusy}
              className="flex h-10 items-center gap-2 rounded-lg bg-success-600 px-3.5 text-theme-sm font-medium text-white transition-colors hover:bg-success-700 disabled:opacity-60"
            >
              <Check className="h-4 w-4" strokeWidth={2.2} />
              Тооллого дуусгах
            </button>
          )}
        </div>
      )}

      {/* Жагсаалт */}
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-gray-200 text-theme-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
              <th className="px-5 py-3.5 font-medium">Нэр</th>
              {!aimag && <th className="px-5 py-3.5 font-medium">Аймаг</th>}
              <th className="px-5 py-3.5 font-medium">Төрөл</th>
              <th className="px-5 py-3.5 font-medium">Байршлын ангилал</th>
              <th className="px-5 py-3.5 font-medium text-right">Тоо</th>
              <th className="px-5 py-3.5 font-medium">Бүрэн бүтэн байдал</th>
              <th className="px-5 py-3.5 text-right font-medium">Үйлдэл</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {loading && assets.length === 0 && (
              <tr>
                <td
                  colSpan={columnCount}
                  className="px-5 py-10 text-center text-theme-sm text-gray-500"
                >
                  Ачаалж байна...
                </td>
              </tr>
            )}

            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="px-5 py-12">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Boxes
                      className="h-9 w-9 text-gray-300 dark:text-gray-600"
                      strokeWidth={1.5}
                    />
                    <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                      {scoped.length === 0
                        ? view === "written_off"
                          ? "Акталсан хөрөнгө алга."
                          : "Эд хөрөнгө бүртгэгдээгүй байна."
                        : "Шүүлтүүрт тохирох бичлэг олдсонгүй."}
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {groups.map((group) => (
              <React.Fragment key={group.key}>
                {/* Бүлэг — Төрөл (жишээ нь Аяга), дор нь ширхэг бүр тусдаа эд хөрөнгө */}
                <tr className="bg-gray-50/80 dark:bg-white/[0.02]">
                  <td colSpan={columnCount} className="px-5 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      aria-expanded={!collapsed.has(group.key)}
                      className="flex w-full flex-wrap items-center gap-2 text-left"
                    >
                      <ChevronRight
                        className={`h-4 w-4 text-gray-400 transition-transform ${collapsed.has(group.key) ? "" : "rotate-90"}`}
                        strokeWidth={2}
                      />
                      <span className="text-theme-sm font-semibold text-gray-900 dark:text-white">{group.name}</span>
                      <span className="text-theme-xs text-gray-500 dark:text-gray-400">{group.assets.length} ширхэг</span>
                      {viewStates.length > 1 &&
                        viewStates.map((state) => {
                          const n = group.assets.filter((asset) => asset.state === state).length;
                          return n > 0 ? (
                            <span key={state} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${assetStateStyles[state]}`}>
                              {assetStateLabels[state]} {n}
                            </span>
                          ) : null;
                        })}
                    </button>
                  </td>
                </tr>

            {!collapsed.has(group.key) && group.assets.map((asset) => (
              // Тооллогын явцад шалгагдсан мөр өнгөөрөө ялгарна
              <tr
                key={asset.id}
                className={`text-theme-sm transition-colors ${
                  removingId === asset.id ? "opacity-50" : ""
                } ${
                  count.checkedAssetIds.has(asset.id)
                    ? "bg-success-50 dark:bg-success-500/10"
                    : ""
                }`}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {/* Зураг дээр дарахад засварлахгүй, зөвхөн харах цонх нээнэ */}
                    <button
                      type="button"
                      onClick={() => setViewing(asset)}
                      aria-label={`${asset.name} — мэдээллийг харах`}
                      title="Мэдээллийг харах"
                      className="flex h-10 w-10 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-white/5"
                    >
                      {asset.images.length > 0 ? (
                        <Image
                          src={asset.images[0].url}
                          alt=""
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Boxes
                          className="h-4.5 w-4.5 text-gray-400 dark:text-gray-500"
                          strokeWidth={1.8}
                        />
                      )}
                    </button>

                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">
                        <span
                          className={`mr-1.5 inline-block rounded-full px-2 py-0.5 align-middle text-[11px] font-medium ${assetStateStyles[asset.state]}`}
                        >
                          {assetStateLabels[asset.state]}
                        </span>
                        {/* Ширхэг бүрийн код — бүлэг дотор ялгах гол тэмдэг */}
                        {asset.code && (
                          <span className="mr-1.5 rounded bg-gray-100 px-1.5 py-0.5 align-middle font-mono text-[12px] text-gray-700 dark:bg-white/10 dark:text-gray-200">
                            {asset.code}
                          </span>
                        )}
                        {asset.name}
                        {asset.images.length > 1 && (
                          <span className="ml-1.5 text-theme-xs font-normal text-gray-400">
                            +{asset.images.length - 1} зураг
                          </span>
                        )}
                      </p>
                      {asset.note && (
                        <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                          {asset.note}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {!aimag && (
                  <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                    {asset.aimag ? labelOf(aimags, asset.aimag) : "—"}
                  </td>
                )}

                <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                  {asset.categoryName ?? "—"}
                </td>

                <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                  {asset.warehouseName ?? "—"}
                </td>

                <td className="px-5 py-4 text-right text-gray-800 dark:text-gray-200">
                  {asset.quantity}
                  <span className="ml-1 text-theme-xs text-gray-400">
                    {asset.unit}
                  </span>
                </td>

                <td className="px-5 py-4">
                  {/* Өнгө нь өөрөө мэдээлэл тул шошгыг нь ч бас бичнэ */}
                  {count.session && (
                    <span
                      className={`mb-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-theme-xs font-medium ${
                        count.checkedAssetIds.has(asset.id)
                          ? "bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400"
                          : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"
                      }`}
                    >
                      {count.checkedAssetIds.has(asset.id) ? (
                        <>
                          <Check className="h-3 w-3" strokeWidth={3} />
                          Тоологдсон
                        </>
                      ) : (
                        "Тоологдоогүй"
                      )}
                    </span>
                  )}

                  {asset.lastCheck ? (
                    <div className="flex flex-col items-start gap-1">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-theme-xs font-medium ${checkStyles[asset.lastCheck.status]}`}
                      >
                        {checkStatusLabels[asset.lastCheck.status]}
                      </span>
                      <span className="text-theme-xs text-gray-400">
                        {shortDate.format(asset.lastCheck.checkedAt)}
                        {asset.lastCheck.foundQuantity !== asset.quantity && (
                          <> · олдсон {asset.lastCheck.foundQuantity}</>
                        )}
                      </span>
                    </div>
                  ) : (
                    <span className="text-theme-xs text-gray-400">
                      Шалгаагүй
                    </span>
                  )}
                </td>

                <td className="px-5 py-4">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewing(asset)}
                      aria-label={`${asset.name} харах`}
                      title="Зөвхөн харах"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
                    >
                      <Eye className="h-4 w-4" strokeWidth={1.8} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setChecking(asset)}
                      aria-label={`${asset.name} шалгах`}
                      title="Бүрэн бүтэн байдлын шалгалт"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
                    >
                      <ClipboardCheck className="h-4 w-4" strokeWidth={1.8} />
                    </button>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(asset);
                          setFormOpen(true);
                        }}
                        aria-label={`${asset.name} засах`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                    )}

                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          disabled={removingId === asset.id}
                          onClick={() => handleDelete(asset)}
                          aria-label={`${asset.name} устгах`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-error-500 transition-colors hover:bg-error-50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-error-500/10"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <AssetFormModal
        isOpen={isFormOpen}
        asset={editing}
        warehouses={warehouses}
        categories={categories}
        names={names}
        lockedAimag={aimag}
        defaultWarehouseId={
          warehouseFilter !== ALL && warehouseFilter !== NONE ? warehouseFilter : null
        }
        defaultState={stateFilter === ALL ? viewStates[0] : stateFilter}
        // Ерөнхий бүртгэл дээр шинэ хөрөнгө зөвхөн «Бүртгэлтэй» ангилалтай
        createStates={view === "general" ? ["registered"] : undefined}
        existingCodes={assetCodes}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />

      <AssetViewModal asset={viewing} onClose={() => setViewing(null)} />

      <MetaManagerModal
        isOpen={isMetaOpen}
        warehouses={warehouses}
        categories={categories}
        onClose={() => setMetaOpen(false)}
        onChanged={load}
        canDelete={canCoding}
      />

      <AssetCheckModal
        asset={checking}
        canRecord={canEdit}
        onClose={() => setChecking(null)}
        onRecorded={load}
      />
    </div>
  );
}
