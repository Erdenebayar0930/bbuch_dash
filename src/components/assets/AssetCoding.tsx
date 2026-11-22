"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Hash, Plus } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import { CODE_RE, codePrefix, formatCode, nextCode } from "@/lib/assetCodes";
import {
  addMetaItem,
  getAssetMeta,
  listAssets,
  setMetaCodeLetter,
  type Asset,
  type RefItem,
} from "@/lib/assets";
import { isAdminRole } from "@/lib/permissions";

type Kind = "warehouse" | "category";

type AssetCodingProps = {
  /** Аймгийн түлхүүр — өгвөл зөвхөн тухайн аймгийн хөрөнгө */
  aimag?: string;
};

/** Нэг угтварын дугаарлалт — ТА-001 … ТА-012 */
type PrefixSeries = {
  prefix: string;
  width: number;
  count: number;
  min: number;
  max: number;
  missing: string[];
};

/** Алгассан дугаарыг хэт олноор харуулахгүй */
const MAX_MISSING_SHOWN = 20;

const fieldClass =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90";

const buttonClass =
  "h-9 shrink-0 rounded-lg bg-accent-600 px-3 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:opacity-50";

const KIND_TEXT: Record<Kind, { title: string; letter: string; namePlaceholder: string; letterPlaceholder: string }> = {
  warehouse: {
    title: "Байршлын ангилал",
    letter: "Эхний үсэг",
    namePlaceholder: "Жишээ нь: Тайз",
    letterPlaceholder: "Т",
  },
  category: {
    title: "Төрөл",
    letter: "2 дахь үсэг",
    namePlaceholder: "Жишээ нь: Аяга",
    letterPlaceholder: "А",
  },
};

/** Бүртгэлтэй кодуудыг угтвараар бүлэглэнэ (акталсных ч эзэлсэнд тооцогдоно) */
function buildSeries(assets: Asset[]): { series: PrefixSeries[]; freeform: string[]; codeless: number } {
  const byPrefix = new Map<string, { width: number; numbers: Set<number> }>();
  const freeform: string[] = [];
  let codeless = 0;

  for (const asset of assets) {
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

  return { series, freeform: freeform.sort(), codeless };
}

/** Үсгийг засах нүд — өөрчилсөн үед л «Хадгалах» гарна */
function LetterEditor({
  kind,
  item,
  canEdit,
  onSaved,
}: {
  kind: Kind;
  item: RefItem;
  canEdit: boolean;
  onSaved: (item: RefItem) => void;
}) {
  const current = item.codeLetter ?? "";
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setValue(current), [current]);

  if (!canEdit) {
    return current ? (
      <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{current}</span>
    ) : (
      <span className="text-gray-400">Оноогоогүй</span>
    );
  }

  const dirty = value.trim().toUpperCase() !== current;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      onSaved(await setMetaCodeLetter(kind, item.id, value.trim()));
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
          onChange={(event) => setValue(event.target.value.toUpperCase())}
          placeholder="—"
          maxLength={8}
          aria-label={`${item.name} — ${KIND_TEXT[kind].letter}`}
          className={`${fieldClass} w-20 text-center font-mono font-semibold`}
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

/** Нэг жагсаалт — Байршлын ангилал эсвэл Төрөл: нэр, үсэг, шинээр нэмэх */
function LetterList({
  kind,
  items,
  counts,
  canEdit,
  onChange,
}: {
  kind: Kind;
  items: RefItem[];
  counts: Map<string, number>;
  canEdit: boolean;
  onChange: (items: RefItem[]) => void;
}) {
  const text = KIND_TEXT[kind];
  const [name, setName] = useState("");
  const [letter, setLetter] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Нэрийг оруулна уу.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const item = await addMetaItem(kind, name.trim(), letter.trim());
      onChange([...items, item]);
      setName("");
      setLetter("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Нэмж чадсангүй.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="surface flex flex-col">
      <div className="border-b border-gray-200 px-5 py-3.5 dark:border-white/10">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white">{text.title}</h3>
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          Нэр ба {text.letter.toLowerCase()} — кодын {kind === "warehouse" ? "эхэнд" : "2 дахь хэсэгт"} орно
        </p>
      </div>

      <table className="w-full text-left text-theme-sm">
        <thead>
          <tr className="text-theme-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <th className="px-5 py-2.5 font-medium">Нэр</th>
            <th className="px-5 py-2.5 font-medium">{text.letter}</th>
            <th className="px-5 py-2.5 text-right font-medium">Ширхэг</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
          {items.length === 0 && (
            <tr>
              <td colSpan={3} className="px-5 py-6 text-center text-gray-400">
                Бүртгэгдээгүй байна.
              </td>
            </tr>
          )}
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{item.name}</td>
              <td className="px-5 py-3">
                <LetterEditor
                  kind={kind}
                  item={item}
                  canEdit={canEdit}
                  onSaved={(saved) =>
                    onChange(items.map((row) => (row.id === saved.id ? { ...row, ...saved } : row)))
                  }
                />
              </td>
              <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-400">{counts.get(item.id) ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {canEdit && (
        <form onSubmit={handleAdd} className="mt-auto border-t border-gray-200 px-5 py-3.5 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={text.namePlaceholder}
              maxLength={60}
              aria-label={`Шинэ ${text.title.toLowerCase()} — нэр`}
              className={`${fieldClass} min-w-0 flex-1`}
            />
            <input
              value={letter}
              onChange={(event) => setLetter(event.target.value.toUpperCase())}
              placeholder={text.letterPlaceholder}
              maxLength={8}
              aria-label={`Шинэ ${text.title.toLowerCase()} — ${text.letter}`}
              className={`${fieldClass} w-20 text-center font-mono font-semibold`}
            />
            <button type="submit" disabled={adding} className={`${buttonClass} flex items-center gap-1`}>
              <Plus className="h-4 w-4" strokeWidth={2} />
              {adding ? "..." : "Нэмэх"}
            </button>
          </div>
          {error && <p className="mt-1.5 text-theme-xs text-error-600 dark:text-error-400">{error}</p>}
        </form>
      )}
    </section>
  );
}

/**
 * «Кодчилол» — кодын бүрэлдэхүүнийг бүртгэнэ:
 *   Байршлын ангиллын эхний үсэг + Төрлийн 2 дахь үсэг + дугаар → ТА-001.
 * Эд хөрөнгө бүртгэхэд хоёуланг нь сонгоход дараагийн код автоматаар
 * үүснэ (@see AssetFormModal). Доор нь бүртгэлтэй кодуудын тойм.
 */
export default function AssetCoding({ aimag }: AssetCodingProps) {
  const { user } = useUser();
  const canEdit =
    isAdminRole(user?.role) || (!!aimag && (user?.aimags ?? []).includes(aimag));

  const [assets, setAssets] = useState<Asset[]>([]);
  const [warehouses, setWarehouses] = useState<RefItem[]>([]);
  const [categories, setCategories] = useState<RefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rows, meta] = await Promise.all([listAssets(aimag), getAssetMeta()]);
      setAssets(rows);
      setWarehouses(meta.warehouses);
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

  const { series, freeform, codeless } = useMemo(() => buildSeries(assets), [assets]);

  const counts = useMemo(() => {
    const byWarehouse = new Map<string, number>();
    const byCategory = new Map<string, number>();
    for (const asset of assets) {
      if (asset.warehouseId) byWarehouse.set(asset.warehouseId, (byWarehouse.get(asset.warehouseId) ?? 0) + 1);
      if (asset.categoryId) byCategory.set(asset.categoryId, (byCategory.get(asset.categoryId) ?? 0) + 1);
    }
    return { byWarehouse, byCategory };
  }, [assets]);

  /** Угтвар → «Байршил · Төрөл» — кодын тоймд аль хослол болохыг харуулна */
  const prefixNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const warehouse of warehouses) {
      for (const category of categories) {
        const prefix = codePrefix(warehouse.codeLetter, category.codeLetter);
        if (prefix && !names.has(prefix)) names.set(prefix, `${warehouse.name} · ${category.name}`);
      }
    }
    return names;
  }, [warehouses, categories]);

  const codes = useMemo(() => assets.map((asset) => asset.code).filter(Boolean), [assets]);

  if (error) {
    return (
      <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
        {error}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-theme-sm text-gray-600 dark:text-gray-400">
        Код = <b>Байршлын ангиллын эхний үсэг</b> + <b>Төрлийн 2 дахь үсэг</b> + дугаар. Жишээ нь Тайз (Т) + Аяга
        (А) → <span className="font-mono">ТА-001</span>. Эд хөрөнгө бүртгэхэд хоёуланг нь сонгоход дараагийн код
        автоматаар үүснэ.
      </p>

      {loading && warehouses.length === 0 && categories.length === 0 ? (
        <p className="text-theme-sm text-gray-500">Ачаалж байна...</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <LetterList
            kind="warehouse"
            items={warehouses}
            counts={counts.byWarehouse}
            canEdit={canEdit}
            onChange={setWarehouses}
          />
          <LetterList
            kind="category"
            items={categories}
            counts={counts.byCategory}
            canEdit={canEdit}
            onChange={setCategories}
          />
        </div>
      )}

      {/* Бүртгэлтэй кодуудын тойм — угтвар бүрээр */}
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-gray-200 text-theme-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
              <th className="px-5 py-3.5 font-medium">Угтвар</th>
              <th className="px-5 py-3.5 font-medium">Байршил · Төрөл</th>
              <th className="px-5 py-3.5 font-medium">Бүртгэлтэй код</th>
              <th className="px-5 py-3.5 text-right font-medium">Тоо</th>
              <th className="px-5 py-3.5 font-medium">Алгассан</th>
              <th className="px-5 py-3.5 font-medium">Дараагийн код</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-theme-sm dark:divide-white/5">
            {!loading && series.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Hash className="h-8 w-8 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
                    <p className="text-gray-500 dark:text-gray-400">Дугаарласан код алга.</p>
                  </div>
                </td>
              </tr>
            )}
            {series.map((item) => (
              <tr key={item.prefix}>
                <td className="px-5 py-3.5 font-mono font-semibold text-gray-800 dark:text-gray-200">
                  {item.prefix || "—"}
                </td>
                <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400">{prefixNames.get(item.prefix) ?? "—"}</td>
                <td className="px-5 py-3.5 font-mono text-gray-600 dark:text-gray-400">
                  {formatCode(item.prefix, item.min, item.width)}
                  {item.max !== item.min && ` … ${formatCode(item.prefix, item.max, item.width)}`}
                </td>
                <td className="px-5 py-3.5 text-right text-gray-800 dark:text-gray-200">{item.count}</td>
                <td className="px-5 py-3.5 font-mono text-theme-xs text-gray-600 dark:text-gray-400">
                  {item.missing.length === 0 ? (
                    <span className="font-sans text-success-600 dark:text-success-400">Дутуугүй</span>
                  ) : (
                    `${item.missing.slice(0, MAX_MISSING_SHOWN).join(", ")}${
                      item.missing.length > MAX_MISSING_SHOWN ? " …" : ""
                    }`
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <span className="rounded bg-accent-50 px-2 py-0.5 font-mono text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                    {nextCode(item.prefix, codes).code}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(freeform.length > 0 || codeless > 0) && (
          <p className="border-t border-gray-200 px-5 py-3 text-theme-xs text-warning-600 dark:border-white/10 dark:text-warning-400">
            {freeform.length > 0 &&
              `Дугааргүй код: ${freeform.slice(0, 8).join(", ")}${freeform.length > 8 ? " …" : ""}. `}
            {codeless > 0 && `Кодгүй ${codeless} ширхэг.`}
          </p>
        )}
      </div>
    </div>
  );
}
