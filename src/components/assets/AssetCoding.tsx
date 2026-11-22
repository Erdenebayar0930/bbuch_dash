"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Hash } from "lucide-react";

import { getAssetMeta, listAssets, type Asset, type RefItem } from "@/lib/assets";

type AssetCodingProps = {
  /** Аймгийн түлхүүр — өгвөл зөвхөн тухайн аймгийн хөрөнгө */
  aimag?: string;
};

/** Нэг угтварын дугаарлалт — AYG-001 … AYG-012 */
type PrefixSeries = {
  prefix: string;
  /** Тооны оронгийн тоо — хамгийн өргөн кодоор (001 → 3) */
  width: number;
  count: number;
  min: number;
  max: number;
  /** min…max доторх алгассан дугаарууд */
  missing: string[];
  next: string;
};

type CategoryCoding = {
  key: string;
  name: string;
  total: number;
  series: PrefixSeries[];
  /** Дугаараар төгсдөггүй кодууд — дугаарлалтад орохгүй */
  freeform: string[];
  codeless: number;
};

/** Дугаараар төгсөх код — угтвар ба дугаар болгон задална */
const CODE_RE = /^(.*?)(\d+)$/;

/** Алгассан дугаарыг хэт олноор харуулахгүй */
const MAX_MISSING_SHOWN = 20;

const fmt = (prefix: string, value: number, width: number) =>
  `${prefix}${String(value).padStart(width, "0")}`;

function buildCoding(assets: Asset[], categories: RefItem[]): CategoryCoding[] {
  const groups = new Map<string, Asset[]>();
  for (const asset of assets) {
    const key = asset.categoryId ?? "";
    groups.set(key, [...(groups.get(key) ?? []), asset]);
  }

  const order = [...categories.map((item) => item.id), ""];
  return order
    .filter((key) => groups.has(key))
    .map((key) => {
      const items = groups.get(key)!;
      const byPrefix = new Map<string, { width: number; numbers: Set<number> }>();
      const freeform: string[] = [];
      let codeless = 0;

      for (const asset of items) {
        const code = asset.code.trim();
        if (!code) {
          codeless += 1;
          continue;
        }
        const match = CODE_RE.exec(code);
        if (!match) {
          freeform.push(code);
          continue;
        }
        const [, prefix, digits] = match;
        const entry = byPrefix.get(prefix) ?? { width: 0, numbers: new Set<number>() };
        entry.width = Math.max(entry.width, digits.length);
        entry.numbers.add(Number(digits));
        byPrefix.set(prefix, entry);
      }

      const series: PrefixSeries[] = [...byPrefix.entries()]
        .map(([prefix, { width, numbers }]) => {
          const sorted = [...numbers].sort((a, b) => a - b);
          const min = sorted[0];
          const max = sorted[sorted.length - 1];
          const missing: string[] = [];
          for (let n = min; n <= max && missing.length <= MAX_MISSING_SHOWN; n += 1) {
            if (!numbers.has(n)) missing.push(fmt(prefix, n, width));
          }
          return {
            prefix,
            width,
            count: numbers.size,
            min,
            max,
            missing,
            next: fmt(prefix, max + 1, width),
          };
        })
        .sort((a, b) => a.prefix.localeCompare(b.prefix));

      return {
        key: key || "__none__",
        name: categories.find((item) => item.id === key)?.name ?? "Төрөлгүй",
        total: items.length,
        series,
        freeform: freeform.sort(),
        codeless,
      };
    });
}

/**
 * «Кодчилол» — Төрөл бүрийн кодын тойм: угтвар, дугаарын муж, алгассан
 * дугаар, дараагийн чөлөөтэй код. Акталсан хөрөнгийн код ч эзэлсэнд тооцогдоно.
 */
export default function AssetCoding({ aimag }: AssetCodingProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<RefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rows, meta] = await Promise.all([listAssets(aimag), getAssetMeta()]);
      setAssets(rows);
      setCategories(meta.categories);
    } catch (err) {
      console.error("Кодчилол ачаалж чадсангүй:", err);
      setError("Кодчиллыг ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, [aimag]);

  useEffect(() => {
    load();
  }, [load]);

  const coding = useMemo(() => buildCoding(assets, categories), [assets, categories]);

  if (error) {
    return (
      <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
        {error}
      </p>
    );
  }

  return (
    <div className="surface overflow-x-auto">
      <table className="w-full min-w-[720px] text-left">
        <thead>
          <tr className="border-b border-gray-200 text-theme-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
            <th className="px-5 py-3.5 font-medium">Төрөл</th>
            <th className="px-5 py-3.5 font-medium">Угтвар</th>
            <th className="px-5 py-3.5 font-medium">Муж</th>
            <th className="px-5 py-3.5 text-right font-medium">Тоо</th>
            <th className="px-5 py-3.5 font-medium">Алгассан</th>
            <th className="px-5 py-3.5 font-medium">Дараагийн код</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-theme-sm dark:divide-white/5">
          {loading && coding.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-10 text-center text-gray-500">
                Ачаалж байна...
              </td>
            </tr>
          )}

          {!loading && coding.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-12">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Hash className="h-9 w-9 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
                  <p className="text-gray-500 dark:text-gray-400">Эд хөрөнгө бүртгэгдээгүй байна.</p>
                </div>
              </td>
            </tr>
          )}

          {coding.map((group) => {
            const extra = [
              group.freeform.length > 0 &&
                `Дугааргүй код: ${group.freeform.slice(0, 5).join(", ")}${group.freeform.length > 5 ? " …" : ""}`,
              group.codeless > 0 && `Кодгүй ${group.codeless} ширхэг`,
            ].filter(Boolean) as string[];
            const rows = Math.max(group.series.length, 1);

            return (
              <React.Fragment key={group.key}>
                {(group.series.length > 0 ? group.series : [null]).map((series, index) => (
                  <tr key={series?.prefix ?? "empty"}>
                    {index === 0 && (
                      <td rowSpan={rows} className="px-5 py-4 align-top">
                        <p className="font-medium text-gray-900 dark:text-white">{group.name}</p>
                        <p className="text-theme-xs text-gray-500 dark:text-gray-400">{group.total} ширхэг</p>
                        {extra.map((line) => (
                          <p key={line} className="mt-1 text-theme-xs text-warning-600 dark:text-warning-400">
                            {line}
                          </p>
                        ))}
                      </td>
                    )}
                    {series ? (
                      <>
                        <td className="px-5 py-4 font-mono text-gray-800 dark:text-gray-200">
                          {series.prefix || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-5 py-4 font-mono text-gray-600 dark:text-gray-400">
                          {fmt(series.prefix, series.min, series.width)}
                          {series.max !== series.min && ` … ${fmt(series.prefix, series.max, series.width)}`}
                        </td>
                        <td className="px-5 py-4 text-right text-gray-800 dark:text-gray-200">{series.count}</td>
                        <td className="px-5 py-4 font-mono text-theme-xs text-gray-600 dark:text-gray-400">
                          {series.missing.length === 0
                            ? <span className="font-sans text-success-600 dark:text-success-400">Дутуугүй</span>
                            : `${series.missing.slice(0, MAX_MISSING_SHOWN).join(", ")}${
                                series.missing.length > MAX_MISSING_SHOWN ? " …" : ""
                              }`}
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded bg-accent-50 px-2 py-0.5 font-mono text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                            {series.next}
                          </span>
                        </td>
                      </>
                    ) : (
                      <td colSpan={5} className="px-5 py-4 text-gray-400">
                        Дугаарласан код алга
                      </td>
                    )}
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
