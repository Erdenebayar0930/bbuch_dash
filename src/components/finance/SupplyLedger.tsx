"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, Package, Pencil, Plus, Trash2 } from "lucide-react";

import SupplyModal from "@/components/finance/SupplyModal";
import { deleteSupply, listSupplies, type Supply } from "@/lib/supplies";
import { dateFormat } from "@/lib/dateFormat";

const money = new Intl.NumberFormat("mn-MN");

const dateFormatter = dateFormat;

const formatDate = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return y ? dateFormatter.format(new Date(y, m - 1, d)) : value;
};

const ALL = "";

/**
 * Санхүү → Хангамж → Чуулганы хангамж. Орж ирсэн мөнгө, эд зүйлсийн бүртгэл.
 * Жилээр, зориулалтаар шүүж нийт дүнг харуулна. Аль ч аймгийн гишүүн үзнэ;
 * бүртгэх, засах, устгах нь зөвхөн админ (`canEdit`, API ч мөн адил).
 */
export default function SupplyLedger({ canEdit = false }: { canEdit?: boolean }) {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [year, setYear] = useState(ALL);
  const [purpose, setPurpose] = useState(ALL);
  const [kind, setKind] = useState<"" | "money" | "item">("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supply | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSupplies(await listSupplies());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const years = useMemo(
    () => [...new Set(supplies.map((item) => item.receivedOn.slice(0, 4)))].sort().reverse(),
    [supplies]
  );
  const purposes = useMemo(
    () =>
      [...new Set(supplies.map((item) => item.purpose).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "mn")
      ),
    [supplies]
  );

  const visible = supplies.filter(
    (item) =>
      (!year || item.receivedOn.startsWith(year)) &&
      (!purpose || item.purpose === purpose) &&
      (!kind || item.kind === kind)
  );

  const totals = visible.reduce(
    (sum, item) => {
      if (item.kind === "money") sum.money += item.amount ?? 0;
      else {
        sum.items += item.quantity;
        sum.itemValue += item.amount ?? 0;
      }
      return sum;
    },
    { money: 0, items: 0, itemValue: 0 }
  );

  const saved = (supply: Supply) =>
    setSupplies((prev) => {
      const next = prev.some((item) => item.id === supply.id)
        ? prev.map((item) => (item.id === supply.id ? supply : item))
        : [supply, ...prev];
      return next.sort((a, b) =>
        a.receivedOn === b.receivedOn
          ? b.createdAt.getTime() - a.createdAt.getTime()
          : b.receivedOn.localeCompare(a.receivedOn)
      );
    });

  const remove = async (supply: Supply) => {
    if (!window.confirm(`«${supply.title}» бүртгэлийг устгах уу?`)) return;
    try {
      await deleteSupply(supply.id);
      setSupplies((prev) => prev.filter((item) => item.id !== supply.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    }
  };

  const selectClass =
    "h-10 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300";

  return (
    <div className="flex flex-col gap-4">
      {/* Нийт дүн — шүүлтэд тохирсон */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="surface flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400">
            <Banknote className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">Орж ирсэн мөнгө</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">
              {money.format(totals.money)}₮
            </p>
          </div>
        </div>
        <div className="surface flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">
            <Package className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">Орж ирсэн эд зүйл</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">
              {money.format(totals.items)} ширхэг
              {totals.itemValue > 0 && (
                <span className="ml-2 text-theme-sm font-normal text-gray-500 dark:text-gray-400">
                  ≈ {money.format(totals.itemValue)}₮
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="surface flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Он" className={selectClass}>
            <option value={ALL}>Бүх он</option>
            {years.map((value) => (
              <option key={value} value={value}>
                {value} он
              </option>
            ))}
          </select>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "" | "money" | "item")}
            aria-label="Төрөл"
            className={selectClass}
          >
            <option value="">Мөнгө ба эд зүйл</option>
            <option value="money">Мөнгө</option>
            <option value="item">Эд зүйл</option>
          </select>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            aria-label="Зориулалт"
            className={selectClass}
          >
            <option value={ALL}>Бүх зориулалт</option>
            {purposes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-4 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              Бүртгэх
            </button>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}

        {loading && supplies.length === 0 ? (
          <p className="py-8 text-center text-theme-sm text-gray-500">Ачаалж байна...</p>
        ) : visible.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-theme-sm text-gray-400 dark:border-white/10">
            {supplies.length === 0
              ? canEdit
                ? "Одоогоор бүртгэл алга. «Бүртгэх» товчоор орж ирсэн мөнгө, эд зүйлээ нэмнэ үү."
                : "Одоогоор бүртгэл алга."
              : "Шүүлтэд тохирох бүртгэл алга."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100 dark:divide-white/5">
            {visible.map((item) => (
              <li key={item.id} className="flex items-start gap-3 py-3">
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    item.kind === "money"
                      ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400"
                      : "bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400"
                  }`}
                >
                  {item.kind === "money" ? (
                    <Banknote className="h-4 w-4" strokeWidth={1.8} />
                  ) : (
                    <Package className="h-4 w-4" strokeWidth={1.8} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {item.title}
                      {item.kind === "item" && item.quantity > 1 && ` × ${item.quantity}`}
                    </span>
                    {item.amount !== null && (
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {item.kind === "item" && "≈ "}
                        {money.format(item.amount)}₮
                      </span>
                    )}
                    {item.purpose && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-theme-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
                        {item.purpose}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                    {[formatDate(item.receivedOn), item.giver].filter(Boolean).join(" · ")}
                  </p>
                  {item.note && (
                    <p className="mt-1 whitespace-pre-line text-theme-sm text-gray-600 dark:text-gray-400">
                      {item.note}
                    </p>
                  )}
                </div>

                {canEdit && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(item);
                        setModalOpen(true);
                      }}
                      aria-label={`«${item.title}»-ийг засах`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-white/5"
                    >
                      <Pencil className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      aria-label={`«${item.title}»-ийг устгах`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit && (
        <SupplyModal
          isOpen={modalOpen}
          supply={editing}
          purposes={purposes}
          onClose={() => setModalOpen(false)}
          onSaved={saved}
        />
      )}
    </div>
  );
}
