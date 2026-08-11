"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  FileSpreadsheet,
  Loader2,
  Share2,
  Upload,
  X,
} from "lucide-react";

import TithePatternEditor from "@/components/finance/TithePatternEditor";
import { formatCurrency } from "@/data/finance";
import { classifyMemo, donationKinds, TITHE } from "@/data/titheOptions";
import { useDonationAccounts } from "@/hooks/useDonationAccounts";
import {
  clearSharedFlag,
  SHARED_FLAG,
  takeSharedFile,
} from "@/lib/shareTarget";
import {
  commitStatement,
  previewStatement,
  type CommitResult,
  type StatementPreviewRow,
} from "@/lib/statement";

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90";

const headCell =
  "px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400";

/**
 * Банкны дансны хуулгыг уншиж, гүйлгээ болгон хадгална.
 *
 * Гурван алхам: файл уншуулах → хүснэгтэн дээр шалгаж засах → баталгаажуулах.
 * Уншуулах алхам ЮУ Ч БИЧИХГҮЙ — буруу таньсан ангилал, нэрийг хадгалахаас
 * өмнө засах боломжтой байх ёстой.
 *
 * Давхардсан мөр (өмнө нь хадгалагдсан) саарлаар харагдаж, хадгалахад
 * оролцохгүй — нэг хуулгыг хоёр удаа уншуулсан ч дүн хоёр дахин нэмэгдэхгүй.
 */
export default function StatementImport() {
  const { accounts } = useDonationAccounts();
  const [account, setAccount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<StatementPreviewRow[]>([]);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [skipped, setSkipped] = useState(0);

  // Данс сүлжээгээр ирдэг тул эхний рендерт хоосон — ирмэгц эхнийхийг сонгоно
  useEffect(() => {
    if (!account && accounts.length > 0) setAccount(accounts[0].number);
  }, [accounts, account]);

  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CommitResult | null>(null);

  /** Банкны аппаас хуваалцаж ирсэн файл — өөрөө сонгогдсон байна */
  const [shared, setShared] = useState(false);

  /**
   * Банкны аппаас «Хуваалцах» дарж ирвэл файл нь service worker-ийн кэшэд
   * хүлээж байдаг — түүнийг аваад шууд сонгогдсон болгоно. Хэрэглэгч зөвхөн
   * дансаа шалгаад «Уншуулах» дарахад л хангалттай.
   */
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has(SHARED_FLAG)) return;

    let alive = true;

    takeSharedFile()
      .then((incoming) => {
        if (!alive || !incoming) return;
        setFile(incoming);
        setShared(true);
      })
      .finally(() => {
        if (alive) clearSharedFlag();
      });

    return () => {
      alive = false;
    };
  }, []);

  /** Хадгалагдах мөрүүд — давхардсаныг оруулахгүй */
  const fresh = useMemo(() => rows.filter((row) => !row.duplicate), [rows]);

  const summary = useMemo(() => {
    let tithe = 0;
    let offering = 0;
    let expense = 0;

    for (const row of fresh) {
      if (row.type === "expense") expense += row.amount;
      else if (row.kind === TITHE) tithe += row.amount;
      else offering += row.amount;
    }

    return { tithe, offering, expense };
  }, [fresh]);

  const handleRead = async () => {
    if (!file) return setError("Excel файлаа сонгоно уу.");

    setReading(true);
    setError("");
    setResult(null);

    try {
      const preview = await previewStatement(account, file);
      setRows(preview.rows);
      setPatterns(preview.patterns);
      setSkipped(preview.skipped);
    } catch (err) {
      console.error("Хуулга уншихад алдаа гарлаа:", err);
      setRows([]);
      setError(err instanceof Error ? err.message : "Уншиж чадсангүй.");
    } finally {
      setReading(false);
    }
  };

  const update = (importKey: string, patch: Partial<StatementPreviewRow>) => {
    setRows((prev) =>
      prev.map((row) =>
        row.importKey === importKey ? { ...row, ...patch } : row
      )
    );
  };

  /**
   * Загвар өөрчлөгдсөн үед мөрүүдийг дахин ангилна — файлыг дахин уншуулах
   * шаардлагагүй. Гараар зассан мөр ч дахин ангилагдана: загварыг зассан гэдэг
   * нь дүрмээ шинэчилсэн гэсэн үг тул шинэ дүрэм давамгайлна.
   */
  const reclassify = (next: string[]) => {
    setPatterns(next);
    setRows((prev) =>
      prev.map((row) =>
        row.type === "income"
          ? { ...row, kind: classifyMemo(row.memo, next) }
          : row
      )
    );
  };

  const handleSave = async () => {
    if (fresh.length === 0) {
      return setError("Хадгалах шинэ мөр алга.");
    }

    setSaving(true);
    setError("");

    try {
      const saved = await commitStatement(account, fresh);
      setResult(saved);
      setRows([]);
      setFile(null);
      setShared(false);
      if (fileInput.current) fileInput.current.value = "";
    } catch (err) {
      console.error("Хуулга хадгалахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Хадгалж чадсангүй.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 1-р алхам: данс ба файл */}
      <div className="surface p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="stmt-account"
              className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Аль дансны хуулга вэ
            </label>
            <select
              id="stmt-account"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              className={fieldClass}
            >
              {accounts.map((item) => (
                <option key={item.number} value={item.number}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="stmt-file"
              className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Excel хуулга (.xlsx)
            </label>

            {/* Хуваалцаж ирсэн файлыг `<input type=file>`-д суулгах боломжгүй
                (хөтөч зөвшөөрдөггүй) тул тусад нь харуулна */}
            {shared && file ? (
              <div className="flex h-11 items-center gap-2 rounded-lg border border-accent-300 bg-accent-50/60 px-3 dark:border-accent-500/40 dark:bg-accent-500/10">
                <Share2
                  className="h-4 w-4 shrink-0 text-accent-600 dark:text-accent-400"
                  strokeWidth={1.8}
                />
                <span className="min-w-0 flex-1 truncate text-theme-sm text-gray-800 dark:text-white/90">
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setShared(false);
                    setRows([]);
                    setError("");
                  }}
                  aria-label="Хуваалцсан файлыг болих"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/60 dark:hover:bg-white/10"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            ) : (
              <input
                id="stmt-file"
                ref={fileInput}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setRows([]);
                  setResult(null);
                  setError("");
                }}
                className="h-11 w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-theme-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-theme-xs file:font-medium file:text-gray-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:file:bg-white/10 dark:file:text-gray-200"
              />
            )}
          </div>
        </div>

        {shared && file && (
          <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
            Банкны аппаас хуваалцсан файл. Дансаа зөв эсэхийг шалгаад
            «Уншуулах» дарна уу.
          </p>
        )}

        <button
          type="button"
          onClick={handleRead}
          disabled={reading || !file}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-accent-600 px-4 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {reading ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
          ) : (
            <Upload className="h-4 w-4" strokeWidth={1.8} />
          )}
          {reading ? "Уншиж байна..." : "Уншуулах"}
        </button>

        {error && (
          <p className="mt-3 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}

        {result && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-success-50 px-4 py-3 text-theme-sm text-success-700 dark:bg-success-500/10 dark:text-success-400">
            <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
            <span>
              {result.saved} гүйлгээ хадгаллаа
              {result.skipped > 0 &&
                `, ${result.skipped} мөр давхардсан тул алгаслаа`}
              . Нэрийн бүртгэлд {result.donors} данс шинэчлэгдэв.
            </span>
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <TithePatternEditor patterns={patterns} onChange={reclassify} />

          {/* 2-р алхам: шалгаж засах */}
          <div className="surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-theme-sm">
                <span className="font-medium text-gray-800 dark:text-white/90">
                  {fresh.length} шинэ мөр
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  1/10: {formatCurrency(summary.tithe)}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  Өргөл: {formatCurrency(summary.offering)}
                </span>
                {summary.expense > 0 && (
                  <span className="text-gray-500 dark:text-gray-400">
                    Зарлага: {formatCurrency(summary.expense)}
                  </span>
                )}
                {rows.length - fresh.length > 0 && (
                  <span className="text-warning-600 dark:text-warning-400">
                    {rows.length - fresh.length} давхардсан
                  </span>
                )}
                {skipped > 0 && (
                  <span className="text-gray-400">
                    {skipped} мөр алгасав (огноо/дүнгүй)
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || fresh.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-4 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" strokeWidth={1.8} />
                )}
                {saving ? "Хадгалж байна..." : "Баталгаажуулж хадгалах"}
              </button>
            </div>

            <div className="max-h-[560px] overflow-auto custom-scrollbar">
              <table className="w-full min-w-[900px] text-left">
                <thead className="sticky top-0 z-10 bg-white dark:bg-navy-900">
                  <tr className="border-b border-gray-100 dark:border-white/10">
                    <th className={headCell}>Огноо</th>
                    <th className={headCell}>Данс эзэмшигч</th>
                    <th className={headCell}>Харьцсан данс</th>
                    <th className={headCell}>Гүйлгээний утга</th>
                    <th className={`${headCell} !text-right`}>Дүн</th>
                    <th className={headCell}>Ангилал</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                  {rows.map((row) => (
                    <tr
                      key={row.importKey}
                      className={
                        row.duplicate
                          ? "bg-gray-50/60 opacity-60 dark:bg-white/[0.02]"
                          : ""
                      }
                    >
                      <td className="num whitespace-nowrap px-3 py-2 text-theme-sm text-navy-700 dark:text-gray-400">
                        {row.date}
                        {row.duplicate && (
                          <span className="mt-0.5 block text-theme-xs text-warning-600 dark:text-warning-400">
                            Хадгалагдсан
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        <input
                          value={row.donorName}
                          onChange={(event) =>
                            update(row.importKey, {
                              donorName: event.target.value,
                            })
                          }
                          disabled={row.duplicate}
                          placeholder="Нэр"
                          maxLength={300}
                          className="h-9 w-full min-w-[160px] rounded-lg border border-gray-200 bg-white px-2.5 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden disabled:bg-transparent dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
                        />
                        {row.fromRegistry && (
                          <span className="mt-0.5 block text-theme-xs text-gray-400">
                            Бүртгэлээс
                          </span>
                        )}
                      </td>

                      <td className="num whitespace-nowrap px-3 py-2 text-theme-xs text-gray-500 dark:text-gray-400">
                        {row.donorAccount || "—"}
                      </td>

                      <td className="max-w-[280px] px-3 py-2 text-theme-sm text-gray-700 dark:text-gray-300">
                        {row.memo || "—"}
                      </td>

                      <td
                        className={`num whitespace-nowrap px-3 py-2 text-right text-theme-sm font-medium ${
                          row.type === "income"
                            ? "text-success-600 dark:text-success-400"
                            : "text-error-500 dark:text-error-400"
                        }`}
                      >
                        {row.type === "income" ? "+" : "−"}
                        {formatCurrency(row.amount)}
                      </td>

                      <td className="px-3 py-2">
                        {row.type === "expense" ? (
                          <span className="text-theme-xs text-gray-400">
                            Зарлага
                          </span>
                        ) : (
                          <div className="flex gap-1">
                            {donationKinds.map((kind) => (
                              <button
                                key={kind}
                                type="button"
                                onClick={() => update(row.importKey, { kind })}
                                disabled={row.duplicate}
                                className={`rounded-lg border px-2.5 py-1 text-theme-xs font-medium transition-colors disabled:cursor-not-allowed ${
                                  row.kind === kind
                                    ? "border-navy-900 bg-navy-900 text-white"
                                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
                                }`}
                              >
                                {kind}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
