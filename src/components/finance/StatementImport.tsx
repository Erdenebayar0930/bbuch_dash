"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";

import TithePatternEditor from "@/components/finance/TithePatternEditor";
import { formatCurrency } from "@/data/finance";
import { classifyMemo, donationKinds, TITHE } from "@/data/titheOptions";
import {
  listTithePatterns,
  previewStatement,
  type StatementPreviewRow,
} from "@/lib/statement";

const headCell =
  "px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400";

/**
 * Банкны дансны хуулгыг (.xlsx) уншиж, гүйлгээний утгаар нь «1/10» ба «Өргөл»
 * гэж ялгаж харуулна.
 *
 * ЮУ Ч ХАДГАЛАХГҮЙ — уншсан үр дүнг шалгах зориулалттай. Сервер таньсан
 * ангиллыг мөр бүр дээр гараар засаж болно; дүн шууд дахин тооцогдоно.
 */
export default function StatementImport() {
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<StatementPreviewRow[]>([]);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [skipped, setSkipped] = useState(0);

  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");

  const summary = useMemo(() => {
    let tithe = 0;
    let titheCount = 0;
    let offering = 0;
    let offeringCount = 0;
    let expense = 0;

    for (const row of rows) {
      if (row.type === "expense") {
        expense += row.amount;
      } else if (row.kind === TITHE) {
        tithe += row.amount;
        titheCount += 1;
      } else {
        offering += row.amount;
        offeringCount += 1;
      }
    }

    return { tithe, titheCount, offering, offeringCount, expense };
  }, [rows]);

  const read = useCallback(async (forFile: File) => {
    setReading(true);
    setError("");

    try {
      const preview = await previewStatement(forFile);
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
  }, []);

  /**
   * Сүүлд уншсан файл. Effect нь давтан ажиллахаас сэргийлнэ — эс бөгөөс
   * `rows` шинэчлэгдэх бүрд дахин уншиж, төгсгөлгүй давтагдана.
   */
  const lastRead = useRef("");

  /** Файл сонгомогц ШУУД уншина — тусад нь «Уншуулах» дарах шаардлагагүй */
  useEffect(() => {
    if (!file) return;

    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (lastRead.current === key) return;

    lastRead.current = key;
    void read(file);
  }, [file, read]);

  /**
   * Загварыг файл уншихаас ӨМНӨ ч харуулна — дүрмээ эхлээд тохируулаад дараа
   * нь хуулга оруулах нь жам ёсны дараалал.
   */
  useEffect(() => {
    let alive = true;

    listTithePatterns()
      .then((list) => {
        if (alive) setPatterns(list);
      })
      .catch((err) => {
        console.error("Загвар уншихад алдаа гарлаа:", err);
      });

    return () => {
      alive = false;
    };
  }, []);

  const setKind = (importKey: string, kind: StatementPreviewRow["kind"]) => {
    setRows((prev) =>
      prev.map((row) => (row.importKey === importKey ? { ...row, kind } : row))
    );
  };

  /**
   * Загвар өөрчлөгдсөн үед мөрүүдийг ДАХИН ангилна — файлыг дахин уншуулах
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

  return (
    <div className="flex flex-col gap-5">
      <div className="surface p-5">
        <label
          htmlFor="stmt-file"
          className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Хаанбанкны хуулга (.xlsx)
        </label>

        <input
          id="stmt-file"
          ref={fileInput}
          type="file"
          accept=".xlsx"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setRows([]);
            setError("");
          }}
          className="h-11 w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-theme-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-theme-xs file:font-medium file:text-gray-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:file:bg-white/10 dark:file:text-gray-200"
        />

        <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
          Интернет банкнаас .xlsx хэлбэрээр татсан хуулгыг сонгоно уу — файл
          сонгомогц шууд уншина.
        </p>

        {/* Файл сонгомогц өөрөө уншина. Явцыг харуулахгүй бол хэрэглэгч юу ч
            болоогүй гэж бодоод дахин сонгох гээд эхэлнэ. */}
        {reading && (
          <p className="mt-4 inline-flex items-center gap-2 text-theme-sm text-gray-600 dark:text-gray-300">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
            Уншиж байна...
          </p>
        )}

        {error && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-error-50 px-4 py-3 dark:bg-error-500/10">
            <p className="text-theme-sm text-error-600 dark:text-error-400">
              {error}
            </p>
            {/* Автомат уншилт унасан үед дахин оролдох цорын ганц зам —
                ижил файлыг дахин сонгуулах нь шаардлагагүй чирэгдэл */}
            {file && !reading && (
              <button
                type="button"
                onClick={() => read(file)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-error-200 bg-white px-3 text-theme-sm font-medium text-error-700 transition-colors hover:bg-error-50 dark:border-error-500/30 dark:bg-transparent dark:text-error-400"
              >
                <Upload className="h-4 w-4" strokeWidth={1.8} />
                Дахин уншуулах
              </button>
            )}
          </div>
        )}
      </div>

      {/* Ялгах дүрэм — хуулга уншсан эсэхээс үл хамааран үргэлж засаж болно */}
      <TithePatternEditor patterns={patterns} onChange={reclassify} />

      {rows.length > 0 && (
        <>
          {/* Ялгасан дүн — хуудсанд орж ирсэн хүн эхлээд ҮҮНИЙГ хардаг */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="surface p-5">
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                1/10
              </p>
              <p className="num mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(summary.tithe)}
              </p>
              <p className="mt-1 text-theme-xs text-gray-400">
                {summary.titheCount} гүйлгээ
              </p>
            </div>

            <div className="surface p-5">
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                Өргөл
              </p>
              <p className="num mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(summary.offering)}
              </p>
              <p className="mt-1 text-theme-xs text-gray-400">
                {summary.offeringCount} гүйлгээ
              </p>
            </div>

            <div className="surface p-5">
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                Зарлага
              </p>
              <p className="num mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(summary.expense)}
              </p>
              <p className="mt-1 text-theme-xs text-gray-400">
                Ангилалд ороогүй
              </p>
            </div>
          </div>

          <div className="surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 dark:border-white/10">
              <span className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                {rows.length} гүйлгээ уншлаа
                {skipped > 0 && (
                  <span className="ml-2 font-normal text-gray-400">
                    ({skipped} мөр алгасав — огноо/дүнгүй)
                  </span>
                )}
              </span>

              <span className="text-theme-xs text-gray-400">
                Ангиллыг мөр тус бүр дээр гараар ч сольж болно
              </span>
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
                    <tr key={row.importKey}>
                      <td className="num whitespace-nowrap px-3 py-2 text-theme-sm text-navy-700 dark:text-gray-400">
                        {row.date}
                      </td>

                      <td className="px-3 py-2 text-theme-sm text-gray-800 dark:text-white/90">
                        {row.donorName || "—"}
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
                                onClick={() => setKind(row.importKey, kind)}
                                className={`rounded-lg border px-2.5 py-1 text-theme-xs font-medium transition-colors ${
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
