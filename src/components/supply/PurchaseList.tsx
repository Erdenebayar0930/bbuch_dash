"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, ShoppingCart, Trash2 } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import ExportButton from "@/components/common/ExportButton";
import {
  purchaseStatusLabels,
  purchaseStatuses,
  type PurchaseStatus,
} from "@/data/supplyOptions";
import { taskPriorityLabels } from "@/data/taskOptions";
import { isAdminRole } from "@/lib/permissions";
import {
  deletePurchase,
  listPurchases,
  updatePurchase,
  type Purchase,
} from "@/lib/purchases";

import PurchaseFormModal from "./PurchaseFormModal";

const statusStyles: Record<PurchaseStatus, string> = {
  requested: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  approved:
    "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400",
  bought:
    "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  rejected: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
};

const priorityStyles: Record<string, string> = {
  low: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  normal:
    "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400",
  high: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
};

const money = new Intl.NumberFormat("mn-MN");

const ALL = "__all__";

/**
 * Худалдан авах жагсаалт.
 *
 * Хангамжийн аймгийн гишүүн бүр хүсэлт гаргана — хэрэгцээг мэддэг нь
 * ихэвчлэн ашиглагч өөрөө. Төлөв шийдэх нь админы эрх.
 */
export default function PurchaseList() {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);
  const myUid = user?.uid ?? "";

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setPurchases(await listPurchases());
    } catch (err) {
      console.error("Худалдан авах жагсаалт ачаалж чадсангүй:", err);
      setError("Жагсаалтыг ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () =>
      statusFilter === ALL
        ? purchases
        : purchases.filter((row) => row.status === statusFilter),
    [purchases, statusFilter]
  );

  /** Хүлээгдэж буй хүсэлтийн төсөвлөсөн нийт дүн */
  const pendingTotal = useMemo(
    () =>
      purchases
        .filter((row) => row.status === "requested" || row.status === "approved")
        .reduce((sum, row) => sum + row.estimatedPrice * row.quantity, 0),
    [purchases]
  );

  /** Хүсэгч өөрөө зөвхөн шийдвэрлэгдээгүй мөрөө засна */
  const canEdit = (row: Purchase) =>
    isAdmin || (row.requestedBy === myUid && row.status === "requested");

  const handleStatus = async (row: Purchase, status: PurchaseStatus) => {
    setBusyId(row.id);
    setError("");

    try {
      const updated = await updatePurchase(row.id, { status });
      setPurchases((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err) {
      console.error("Төлөв солиход алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Төлөв солиход алдаа гарлаа.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (row: Purchase) => {
    if (!window.confirm(`"${row.name}" мөрийг устгах уу?`)) return;

    setBusyId(row.id);
    setError("");

    try {
      await deletePurchase(row.id);
      setPurchases((prev) => prev.filter((item) => item.id !== row.id));
    } catch (err) {
      console.error("Устгахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    } finally {
      setBusyId(null);
    }
  };

  const selectClass =
    "h-10 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-800 transition-colors focus:border-accent-400 focus:outline-hidden dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90";

  return (
    <div className="flex flex-col gap-5">
      {/* Төлөв тус бүрийн тойм */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {purchaseStatuses.map((status) => {
          const count = purchases.filter((row) => row.status === status).length;

          return (
            <button
              key={status}
              type="button"
              onClick={() =>
                setStatusFilter((prev) => (prev === status ? ALL : status))
              }
              className={`rounded-xl border p-4 text-left transition-colors ${
                statusFilter === status
                  ? "border-accent-500 bg-accent-50/60 dark:border-accent-500 dark:bg-accent-500/10"
                  : "border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
              }`}
            >
              <span className="block truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                {purchaseStatusLabels[status]}
              </span>
              <span className="mt-1 block text-theme-xs text-gray-500 dark:text-gray-400">
                {count} мөр
              </span>
            </button>
          );
        })}
      </div>

      {/* Шүүлтүүр ба үйлдэл */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Төлөвөөр шүүх"
          className={selectClass}
        >
          <option value={ALL}>Бүх төлөв</option>
          {purchaseStatuses.map((status) => (
            <option key={status} value={status}>
              {purchaseStatusLabels[status]}
            </option>
          ))}
        </select>

        <span className="rounded-lg bg-gray-100 px-3 py-2 text-theme-sm text-gray-600 dark:bg-white/5 dark:text-gray-400">
          Шийдэгдээгүй төсөв: {money.format(pendingTotal)}₮
        </span>

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

        <ExportButton dataset="purchases" />

        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-3.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} />
          Хүсэлт нэмэх
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[840px] text-left">
          <thead>
            <tr className="border-b border-gray-200 text-theme-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
              <th className="px-5 py-3.5 font-medium">Бараа</th>
              <th className="px-5 py-3.5 font-medium text-right">Тоо</th>
              <th className="px-5 py-3.5 font-medium text-right">Нэгж үнэ</th>
              <th className="px-5 py-3.5 font-medium text-right">Нийт</th>
              <th className="px-5 py-3.5 font-medium">Ач холбогдол</th>
              <th className="px-5 py-3.5 font-medium">Хүсэгч</th>
              <th className="px-5 py-3.5 font-medium">Төлөв</th>
              <th className="px-5 py-3.5 text-right font-medium">Үйлдэл</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {loading && purchases.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-10 text-center text-theme-sm text-gray-500"
                >
                  Ачаалж байна...
                </td>
              </tr>
            )}

            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <ShoppingCart
                      className="h-9 w-9 text-gray-300 dark:text-gray-600"
                      strokeWidth={1.5}
                    />
                    <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                      {purchases.length === 0
                        ? "Хүсэлт бүртгэгдээгүй байна."
                        : "Шүүлтүүрт тохирох мөр олдсонгүй."}
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {visible.map((row) => (
              <tr
                key={row.id}
                className={`text-theme-sm transition-colors ${
                  busyId === row.id ? "opacity-50" : ""
                }`}
              >
                <td className="px-5 py-4">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {row.name}
                  </p>
                  {row.note && (
                    <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                      {row.note}
                    </p>
                  )}
                </td>

                <td className="px-5 py-4 text-right text-gray-800 dark:text-gray-200">
                  {row.quantity}
                  <span className="ml-1 text-theme-xs text-gray-400">
                    {row.unit}
                  </span>
                </td>

                <td className="px-5 py-4 text-right text-gray-600 dark:text-gray-400">
                  {row.estimatedPrice ? `${money.format(row.estimatedPrice)}₮` : "—"}
                </td>

                <td className="px-5 py-4 text-right text-gray-800 dark:text-gray-200">
                  {row.estimatedPrice
                    ? `${money.format(row.estimatedPrice * row.quantity)}₮`
                    : "—"}
                </td>

                <td className="px-5 py-4">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-theme-xs font-medium ${priorityStyles[row.priority]}`}
                  >
                    {taskPriorityLabels[row.priority]}
                  </span>
                </td>

                <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                  {row.requesterName || "—"}
                </td>

                <td className="px-5 py-4">
                  {/* Админ төлөвийг шууд эндээс сольж чадна */}
                  {isAdmin ? (
                    <select
                      value={row.status}
                      disabled={busyId === row.id}
                      onChange={(event) =>
                        handleStatus(row, event.target.value as PurchaseStatus)
                      }
                      aria-label={`${row.name} — төлөв солих`}
                      className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-theme-xs text-gray-800 focus:border-accent-400 focus:outline-hidden disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
                    >
                      {purchaseStatuses.map((status) => (
                        <option key={status} value={status}>
                          {purchaseStatusLabels[status]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-theme-xs font-medium ${statusStyles[row.status]}`}
                    >
                      {purchaseStatusLabels[row.status]}
                    </span>
                  )}
                </td>

                <td className="px-5 py-4">
                  <div className="flex justify-end gap-1.5">
                    {canEdit(row) && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(row);
                            setFormOpen(true);
                          }}
                          aria-label={`${row.name} засах`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
                        >
                          <Pencil className="h-4 w-4" strokeWidth={1.8} />
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => handleDelete(row)}
                          aria-label={`${row.name} устгах`}
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
          </tbody>
        </table>
      </div>

      <PurchaseFormModal
        isOpen={isFormOpen}
        purchase={editing}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />
    </div>
  );
}