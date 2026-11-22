"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Hash, Plus } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import { CODE_RE, formatCode, nextCode } from "@/lib/assetCodes";
import {
  addMetaItem,
  getAssetMeta,
  listAssets,
  setCategoryCodePrefix,
  type Asset,
  type RefItem,
} from "@/lib/assets";
import { isAdminRole } from "@/lib/permissions";

type AssetCodingProps = {
  /** Аймгийн түлхүүр — өгвөл зөвхөн тухайн аймгийн хөрөнгө */
  aimag?: string;
};

/** Нэг угтварын дугаарлалт — AYG-001 … AYG-012 */
type PrefixSeries = {
  prefix: string;
  width: number;
  count: number;
  min: number;
  max: number;
  /** min…max доторх алгассан дугаарууд */
  missing: string[];
};

type CategoryCoding = {
  /** null бол «Төрөлгүй» */
  category: RefItem | null;
  total: number;
  series: PrefixSeries[];
  /** Дугаараар төгсдөггүй кодууд — дугаарлалтад орохгүй */
  freeform: string[];
  codeless: number;
  codes: string[];
};

/** Алгассан дугаарыг хэт олноор харуулахгүй */
const MAX_MISSING_SHOWN = 20;

const fieldClass =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90";

const buttonClass =
  "h-9 shrink-0 rounded-lg bg-accent-600 px-3 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:opacity-50";

function buildCoding(assets: Asset[], categories: RefItem[]): CategoryCoding[] {
  const groups = new Map<string, Asset[]>();
  for (const asset of assets) {
    const key = asset.categoryId ?? "";
    groups.set(key, [...(groups.get(key) ?? []), asset]);
  }

  // Төрөл бүр (бүртгэлгүй ч гэсэн угтвар оноох боломжтой), дараа нь Төрөлгүй
  const rows: (RefItem | null)[] = [...categories, ...(groups.has("") ? [null] : [])];

  return rows.map((category) => {
    const items = groups.get(category?.id ?? "") ?? [];
    const byPrefix = new Map<string, { width: number; numbers: Set<number> }>();
    const freeform: string[] = [];
    const codes: string[] = [];
    let codeless = 0;

    for (const asset of items) {
      const code = asset.code.trim();
      if (!code) {
        codeless += 1;
        continue;
      }
      codes.push(code);
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

    const series = [...byPrefix.entries()]
      .map(([prefix, { width, numbers }]) => {
        const sorted = [...numbers].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const missing: string[] = [];
        for (let n = min; n <= max && missing.length <= MAX_MISSING_SHOWN; n += 1) {
          if (!numbers.has(n)) missing.push(formatCode(prefix, n, width));
        }
        return { prefix, width, count: numbers.size, min, max, missing };
      })
      .sort((a, b) => a.prefix.localeCompare(b.prefix));

    return { category, total: items.length, series, freeform: freeform.sort(), codeless, codes };
  });
}

/** Төрлийн угтварыг засах нүд — өөрчилсөн үед л «Хадгалах» идэвхтэй */
function PrefixEditor({
  category,
  canEdit,
  onSaved,
}: {
  category: RefItem;
  canEdit: boolean;
  onSaved: (item: RefItem) => void;
}) {
  const current = category.codePrefix ?? "";
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setValue(current), [current]);

  if (!canEdit) {
    return current ? (
      <span className="font-mono text-gray-800 dark:text-gray-200">{current}</span>
    ) : (
      <span className="text-gray-400">Оноогоогүй</span>
    );
  }

  const dirty = value.trim() !== current;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      onSaved(await setCategoryCodePrefix(category.id, value.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалж чадсангүй.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <form
        className="flex items-center gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (dirty) save();
        }}
      >
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="AYG-"
          maxLength={32}
          aria-label={`${category.name} — кодын угтвар`}
          className={`${fieldClass} w-28 font-mono`}
        />
        {dirty && (
          <button type="submit" disabled={saving} className={buttonClass}>
            {saving ? "..." : "Хадгалах"}
          </button>
        )}
      </form>
      {error && <p className="mt-1 text-theme-xs text-error-600 dark:text-error-400">{error}</p>}
    </div>
  );
}

/**
 * «Кодчилол» — Төрөл бүрийн кодын угтварыг бүртгэнэ (бүртгэх маягт Төрөл
 * сонгоход дараагийн кодыг эндээс автоматаар бөглөнө). Мөн бүртгэлтэй
 * кодуудын муж, алгассан дугаар, дараагийн чөлөөтэй кодыг харуулна.
 * Акталсан хөрөнгийн код ч эзэлсэнд тооцогдоно.
 */
export default function AssetCoding({ aimag }: AssetCodingProps) {
  const { user } = useUser();
  const canEdit =
    isAdminRole(user?.role) || (!!aimag && (user?.aimags ?? []).includes(aimag));

  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<RefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [newPrefix, setNewPrefix] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

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

  const replaceCategory = (item: RefItem) =>
    setCategories((prev) => prev.map((row) => (row.id === item.id ? { ...row, ...item } : row)));

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) {
      setAddError("Төрлийн нэрийг оруулна уу.");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      const item = await addMetaItem("category", newName.trim(), newPrefix.trim());
      setCategories((prev) => [...prev, item]);
      setNewName("");
      setNewPrefix("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Нэмж чадсангүй.");
    } finally {
      setAdding(false);
    }
  };

  if (error) {
    return (
      <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
        {error}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <form onSubmit={handleAdd} className="surface flex flex-col gap-2 p-4">
          <p className="text-theme-sm font-medium text-gray-800 dark:text-gray-200">Кодчилол бүртгэх</p>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Төрөл бүрт кодын угтвар оноовол эд хөрөнгө бүртгэхэд Төрөл сонгоход дараагийн код (жишээ нь AYG-001)
            автоматаар бөглөгдөнө.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Төрөл, жишээ нь: Аяга"
              maxLength={60}
              aria-label="Шинэ төрлийн нэр"
              className={`${fieldClass} w-56`}
            />
            <input
              value={newPrefix}
              onChange={(event) => setNewPrefix(event.target.value)}
              placeholder="Угтвар: AYG-"
              maxLength={32}
              aria-label="Кодын угтвар"
              className={`${fieldClass} w-36 font-mono`}
            />
            <button type="submit" disabled={adding} className={`${buttonClass} flex items-center gap-1`}>
              <Plus className="h-4 w-4" strokeWidth={2} />
              {adding ? "Нэмж байна..." : "Нэмэх"}
            </button>
          </div>
          {addError && <p className="text-theme-xs text-error-600 dark:text-error-400">{addError}</p>}
        </form>
      )}

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-gray-200 text-theme-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
              <th className="px-5 py-3.5 font-medium">Төрөл</th>
              <th className="px-5 py-3.5 font-medium">Угтвар</th>
              <th className="px-5 py-3.5 font-medium">Бүртгэлтэй код</th>
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
                    <p className="text-gray-500 dark:text-gray-400">Төрөл бүртгэгдээгүй байна.</p>
                  </div>
                </td>
              </tr>
            )}

            {coding.map((group) => {
              const prefix = group.category?.codePrefix ?? "";
              const next = prefix ? nextCode(prefix, group.codes).code : "";
              const extra = [
                group.freeform.length > 0 &&
                  `Дугааргүй код: ${group.freeform.slice(0, 5).join(", ")}${group.freeform.length > 5 ? " …" : ""}`,
                group.codeless > 0 && `Кодгүй ${group.codeless} ширхэг`,
              ].filter(Boolean) as string[];
              const rows = Math.max(group.series.length, 1);
              const key = group.category?.id ?? "__none__";

              return (
                <React.Fragment key={key}>
                  {(group.series.length > 0 ? group.series : [null]).map((series, index) => (
                    <tr key={series?.prefix ?? "empty"}>
                      {index === 0 && (
                        <>
                          <td rowSpan={rows} className="px-5 py-4 align-top">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {group.category?.name ?? "Төрөлгүй"}
                            </p>
                            <p className="text-theme-xs text-gray-500 dark:text-gray-400">{group.total} ширхэг</p>
                            {extra.map((line) => (
                              <p key={line} className="mt-1 text-theme-xs text-warning-600 dark:text-warning-400">
                                {line}
                              </p>
                            ))}
                          </td>
                          <td rowSpan={rows} className="px-5 py-4 align-top">
                            {group.category ? (
                              <PrefixEditor category={group.category} canEdit={canEdit} onSaved={replaceCategory} />
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </>
                      )}
                      {series ? (
                        <>
                          <td className="px-5 py-4 font-mono text-gray-600 dark:text-gray-400">
                            {formatCode(series.prefix, series.min, series.width)}
                            {series.max !== series.min &&
                              ` … ${formatCode(series.prefix, series.max, series.width)}`}
                          </td>
                          <td className="px-5 py-4 text-right text-gray-800 dark:text-gray-200">{series.count}</td>
                          <td className="px-5 py-4 font-mono text-theme-xs text-gray-600 dark:text-gray-400">
                            {series.missing.length === 0 ? (
                              <span className="font-sans text-success-600 dark:text-success-400">Дутуугүй</span>
                            ) : (
                              `${series.missing.slice(0, MAX_MISSING_SHOWN).join(", ")}${
                                series.missing.length > MAX_MISSING_SHOWN ? " …" : ""
                              }`
                            )}
                          </td>
                        </>
                      ) : (
                        <td colSpan={3} className="px-5 py-4 text-gray-400">
                          Дугаарласан код алга
                        </td>
                      )}
                      {index === 0 && (
                        <td rowSpan={rows} className="px-5 py-4 align-top">
                          {next ? (
                            <span className="rounded bg-accent-50 px-2 py-0.5 font-mono text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                              {next}
                            </span>
                          ) : (
                            <span className="text-theme-xs text-gray-400">Угтвар оноогоогүй</span>
                          )}
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
    </div>
  );
}
