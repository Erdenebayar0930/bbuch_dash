"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, X } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import PeriodFilter from "@/components/finance/PeriodFilter";
import SummaryTile from "@/components/finance/SummaryTile";
import TransactionFormModal from "@/components/finance/TransactionFormModal";
import TransactionsTable from "@/components/finance/TransactionsTable";
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
import { useDonationAccounts } from "@/hooks/useDonationAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import { isAdminRole } from "@/lib/permissions";
import { deleteTransaction, updateTransaction } from "@/lib/transactions";

type TypeFilter = "all" | TransactionType;

const typeTabs: { key: TypeFilter; name: string }[] = [
  { key: "all", name: "Бүгд" },
  { key: "income", name: "Орлого" },
  { key: "expense", name: "Зарлага" },
];

/** Данс сонгох жагсаалтын тусгай утгууд — дансны дугаартай мөргөлдөхгүй */
const ALL_ACCOUNTS = "__all__";
const NO_ACCOUNT = "";

/**
 * Хандивын дансны гүйлгээний бүртгэл.
 *
 * Данс сонгоход тухайн данснаас орсон гүйлгээ л үлдэнэ — «1/10 ба өргөл»
 * данс хэдэн төгрөг цуглуулсныг тусад нь харах гол зорилготой. Бэлнээр авсан
 * өргөл ямар ч данс дамжаагүй байдаг тул «Данстай холбоогүй» бүлэг бас байна.
 *
 * Бичих эрх нь админд — сервер тал (`POST /api/transactions`) мөн адил
 * шалгадаг тул энэ нь зөвхөн товчийг нуух давхарга.
 */
export default function AccountLedger() {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);

  const { items, loading, error, refresh } = useTransactions();

  // Гүйлгээг нь харах эрхтэй данс л сонголтод орно — картууд бүгдэд
  // харагддаг ч доторх нь хаалттай байж болно
  const { accounts, loading: accountsLoading } = useDonationAccounts();
  const visibleAccounts = useMemo(
    () => accounts.filter((item) => item.canView),
    [accounts]
  );

  const [account, setAccount] = useState<string>(ALL_ACCOUNTS);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  // Дансаар эхэлж шүүнэ — он/сарын сонголт нь тухайн дансны түүхээс хамаарна
  const accountItems = useMemo(
    () =>
      account === ALL_ACCOUNTS
        ? items
        : items.filter((item) => item.account === account),
    [items, account]
  );

  const [picked, setPicked] = useState<Period | null>(null);
  const { year, month } = picked ?? latestPeriod(accountItems);

  const years = useMemo(
    () => yearsFrom(accountItems, year),
    [accountItems, year]
  );
  const periodItems = useMemo(
    () => filterByPeriod(accountItems, year, month),
    [accountItems, year, month]
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

  // Маягт зөвхөн ЗАСАХ горимд нээгддэг — нэмэх нь /statement дээр
  const handleSubmit = async (input: TransactionInput) => {
    if (!editing) return;

    await updateTransaction(editing.id, input);
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

  // Нэг ч данс оноогоогүй хүнд хоосон хүснэгт үзүүлэх нь эвдэрсэн мэт
  // харагдана — шалтгааныг нь хэлж, хэнд хандахыг зааж өгнө
  if (!accountsLoading && visibleAccounts.length === 0) {
    return (
      <div className="surface flex min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-base font-medium text-gray-800 dark:text-white/90">
          Данс оноогоогүй байна
        </p>
        <p className="max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
          Дансны гүйлгээг харахын тулд админ танд тухайн дансны эрхийг олгох
          шаардлагатай.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[240px] flex-1">
          <label
            htmlFor="ledger-account"
            className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Гүйлгээний бүртгэл
          </label>
          <select
            id="ledger-account"
            value={account}
            onChange={(event) => {
              setAccount(event.target.value);
              // Өөр дансанд өөр хугацаа сүүлчийнх байна — сонголтыг сэргээнэ
              setPicked(null);
            }}
            className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-theme-sm text-gray-800 transition-colors focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
          >
            <option value={ALL_ACCOUNTS}>Бүх данс</option>
            {visibleAccounts.map((item) => (
              <option key={item.number} value={item.number}>
                {item.title}
              </option>
            ))}
            <option value={NO_ACCOUNT}>Данстай холбоогүй</option>
          </select>
        </div>

        {/* Оруулах нь тусдаа цэстэй — энд зөвхөн харах, засах. Хоёр газраас
            нэмдэг байвал «аль нь вэ» гэсэн эргэлзээ үүснэ. */}
        {isAdmin && (
          <Link
            href="/statement"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent-600 px-3.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            Гүйлгээ оруулах
          </Link>
        )}
      </div>

      {error && (
        <div className="surface border-error-200 bg-error-50 p-4 text-theme-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
          Гүйлгээ унших үед алдаа гарлаа. Холболтоо шалгаад дахин оролдоно уу.
        </div>
      )}

      <PeriodFilter
        years={years}
        year={year}
        month={month}
        onYearChange={(value) => setPicked({ year: value, month })}
        onMonthChange={(value) => setPicked({ year, month: value })}
        summary={
          loading
            ? "Ачаалж байна..."
            : `${label} · ${periodItems.length} гүйлгээ`
        }
      />

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
            onEdit={
              isAdmin
                ? (item) => {
                    setEditing(item);
                    setFormOpen(true);
                  }
                : undefined
            }
            onDelete={isAdmin ? (item) => handleDelete(item.id) : undefined}
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
