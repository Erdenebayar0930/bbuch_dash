"use client";

import React, { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";

import PeriodFilter from "@/components/finance/PeriodFilter";
import SummaryTile from "@/components/finance/SummaryTile";
import TransactionFormModal from "@/components/finance/TransactionFormModal";
import TransactionsTable from "@/components/finance/TransactionsTable";
import { seedTransactionRows } from "@/data/seedTransactions";
import {
  filterByPeriod,
  formatCompact,
  latestPeriod,
  periodLabel,
  summarize,
  yearsFrom,
  type Period,
  type Transaction,
  type TransactionInput,
  type TransactionType,
} from "@/data/finance";
import { useTransactions } from "@/hooks/useTransactions";
import {
  createTransaction,
  deleteTransaction,
  seedTransactions,
  updateTransaction,
} from "@/lib/transactions";

type TypeFilter = "all" | TransactionType;

const typeTabs: { key: TypeFilter; name: string }[] = [
  { key: "all", name: "Бүгд" },
  { key: "income", name: "Орлого" },
  { key: "expense", name: "Зарлага" },
];

export default function TransactionsPage() {
  const { items, loading, error, refresh } = useTransactions();

  // Сонголт хийгээгүй үед хамгийн сүүлийн гүйлгээтэй үеийг харуулна
  const [picked, setPicked] = useState<Period | null>(null);
  const { year, month } = picked ?? latestPeriod(items);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [seeding, setSeeding] = useState(false);

  const years = useMemo(() => yearsFrom(items, year), [items, year]);
  const periodItems = useMemo(
    () => filterByPeriod(items, year, month),
    [items, year, month]
  );
  const totals = useMemo(() => summarize(periodItems), [periodItems]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return periodItems.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (!needle) return true;

      return (
        item.description.toLowerCase().includes(needle) ||
        item.category.toLowerCase().includes(needle)
      );
    });
  }, [periodItems, typeFilter, query]);

  const label = periodLabel(year, month);

  const handleSubmit = async (input: TransactionInput) => {
    if (editing) {
      await updateTransaction(editing.id, input);
    } else {
      await createTransaction(input);
    }
    // Postgres-д realtime суваг байхгүй тул гараар шинэчилнэ
    await refresh();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
      await refresh();
    } catch (deleteError) {
      console.error("Гүйлгээ устгахад алдаа гарлаа:", deleteError);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedTransactions(seedTransactionRows);
      await refresh();
    } catch (seedError) {
      console.error("Жишиг өгөгдөл бичихэд алдаа гарлаа:", seedError);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Хуудасны толгой */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Орлого ба Зарлага
          </h1>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            Бүх санхүүгийн гүйлгээний бүртгэл
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-3.5 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} />
          Гүйлгээ нэмэх
        </button>
      </div>

      {error && (
        <div className="surface border-error-200 bg-error-50 p-4 text-theme-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
          Өгөгдөл унших үед алдаа гарлаа. Холболтоо шалгаад дахин оролдоно уу.
        </div>
      )}

      {/* Хугацааны шүүлтүүр */}
      <PeriodFilter
        years={years}
        year={year}
        month={month}
        onYearChange={(value) => setPicked({ year: value, month })}
        onMonthChange={(value) => setPicked({ year, month: value })}
        summary={
          loading ? "Ачаалж байна..." : `${label} · ${periodItems.length} гүйлгээ`
        }
      />

      {/* Дүнгийн хураангуй */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <SummaryTile
          tone="income"
          label="Нийт орлого"
          value={formatCompact(totals.income)}
          caption={label}
        />
        <SummaryTile
          tone="expense"
          label="Нийт зарлага"
          value={formatCompact(totals.expense)}
          caption={label}
        />
        <SummaryTile
          tone="net"
          label="Цэвэр дүн"
          value={formatCompact(totals.net)}
          caption={label}
        />
      </div>

      {/* Гүйлгээний жагсаалт */}
      <div className="surface">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {typeTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTypeFilter(tab.key)}
                className={`rounded-lg border px-4 py-2 text-theme-sm font-medium transition-colors ${
                  tab.key === typeFilter
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/10"
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>

          {isSearchOpen ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Тайлбар, ангилалаар хайх"
                className="h-9 w-full min-w-[240px] rounded-lg border border-gray-200 bg-white pl-9 pr-9 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
              />
              <button
                type="button"
                aria-label="Хайлт хаах"
                onClick={() => {
                  setQuery("");
                  setSearchOpen(false);
                }}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-theme-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/10"
            >
              <Search className="h-4 w-4" strokeWidth={1.8} />
              Хайх
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-[180px] items-center justify-center text-theme-sm text-gray-500 dark:text-gray-400">
            Гүйлгээ ачаалж байна...
          </div>
        ) : (
          <TransactionsTable
            items={visibleItems}
            onEdit={(item) => {
              setEditing(item);
              setFormOpen(true);
            }}
            onDelete={(item) => handleDelete(item.id)}
            emptyAction={
              items.length === 0 ? (
                <button
                  type="button"
                  onClick={handleSeed}
                  disabled={seeding}
                  className="mt-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
                >
                  {seeding ? "Бичиж байна..." : "Жишиг өгөгдөл оруулах"}
                </button>
              ) : null
            }
          />
        )}
      </div>

      <TransactionFormModal
        isOpen={isFormOpen}
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
