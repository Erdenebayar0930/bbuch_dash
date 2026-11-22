"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Hash, Lock, Pencil, Plus, Trash2 } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import { CODE_RE, codePrefix, formatCode, initials, nextCode } from "@/lib/assetCodes";
import {
  addMetaItem,
  deleteMetaItem,
  getAssetMeta,
  listAssets,
  updateMetaItem,
  type Asset,
  type MetaKind,
  type RefItem,
} from "@/lib/assets";
import { isAdminRole } from "@/lib/permissions";

type Kind = MetaKind;

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

/** Нэрийг харьцуулах хэлбэр — том жижиг үсэг, илүү зайг үл тооно */
const normName = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Жагсаалт дотор давхцал — үсэг ба нэр. Олдвол алдааны мессеж, үгүй бол "".
 * Сервер ч мөн шалгана; энд бичих үед нь шууд сануулна.
 */
function findClash(items: RefItem[], selfId: string | null, name: string, letter: string): string {
  const others = items.filter((item) => item.id !== selfId);
  const code = letter.trim().toUpperCase();
  const byLetter = code ? others.find((item) => (item.codeLetter ?? "") === code) : undefined;
  if (byLetter) return `«${code}» үсгийг «${byLetter.name}» ашиглаж байна.`;
  const key = normName(name);
  const byName = key ? others.find((item) => normName(item.name) === key) : undefined;
  if (byName) return `«${byName.name}» аль хэдийн бүртгэлтэй.`;
  return "";
}

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
    namePlaceholder: "Жишээ нь: Гал тогоо",
    letterPlaceholder: "Г",
  },
  name: {
    title: "Нэр",
    letter: "3 дахь үсэг",
    namePlaceholder: "Жишээ нь: Аяга таваг",
    letterPlaceholder: "АТ",
  },
};

/** Кодын аль хэсэгт орох вэ — жагсаалтын тайлбарт */
const KIND_POSITION: Record<Kind, string> = {
  warehouse: "эхэнд",
  category: "2 дахь хэсэгт",
  name: "3 дахь хэсэгт (тоон дугаарын өмнө)",
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

/**
 * Жагсаалтын нэг мөр — нэр, үсэг, ширхэг. «Засах»-аар нэр ба үсгийг засна,
 * «Устгах» нь зөвхөн админд (холбогдох хөрөнгө устахгүй, талбар нь хоосорно).
 */
function ItemRow({
  kind,
  item,
  items,
  count,
  canEdit,
  canDelete,
  onSaved,
  onDeleted,
}: {
  kind: Kind;
  item: RefItem;
  /** Тухайн жагсаалтын бүх мөр — давхцал шалгахад */
  items: RefItem[];
  count: number;
  canEdit: boolean;
  canDelete: boolean;
  onSaved: (item: RefItem) => void;
  onDeleted: (id: string) => void;
}) {
  const text = KIND_TEXT[kind];
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [letter, setLetter] = useState(item.codeLetter ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const startEdit = () => {
    setName(item.name);
    setLetter(item.codeLetter ?? "");
    setError("");
    setEditing(true);
  };

  const clash = editing ? findClash(items, item.id, name, letter) : "";

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (clash) return;
    const patch: { name?: string; codeLetter?: string } = {};
    if (name.trim() !== item.name) patch.name = name.trim();
    if (letter.trim().toUpperCase() !== (item.codeLetter ?? "")) patch.codeLetter = letter.trim();
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      onSaved(await updateMetaItem(kind, item.id, patch));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалж чадсангүй.");
    } finally {
      setBusy(false);
    }
  };

  /** Эд хөрөнгө ашиглаж буй бол кодын багц (үсэг) түгжээтэй, устгахгүй */
  const inUse = count > 0;

  const remove = async () => {
    if (inUse) return;
    if (!window.confirm(`«${item.name}»-г устгах уу?`)) return;
    setBusy(true);
    setError("");
    try {
      await deleteMetaItem(kind, item.id);
      onDeleted(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Устгаж чадсангүй.");
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <tr>
        <td colSpan={4} className="px-5 py-3">
          <form onSubmit={save} className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              aria-label={`${text.title} — нэр`}
              className={`${fieldClass} min-w-0 flex-1`}
              autoFocus
            />
            <input
              value={letter}
              onChange={(event) => setLetter(event.target.value.toUpperCase())}
              placeholder="—"
              maxLength={8}
              aria-label={`${text.title} — ${text.letter}`}
              disabled={inUse}
              title={inUse ? `${count} эд хөрөнгө ашиглаж байгаа тул үсэг өөрчлөгдөхгүй` : undefined}
              className={`${fieldClass} w-20 text-center font-mono font-semibold disabled:opacity-60`}
            />
            <button type="submit" disabled={busy || !!clash} className={buttonClass}>
              {busy ? "..." : "Хадгалах"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
              className="h-9 rounded-lg border border-gray-200 px-3 text-theme-sm text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Болих
            </button>
          </form>
          {(clash || error) && (
            <p className="mt-1 text-theme-xs text-error-600 dark:text-error-400">{clash || error}</p>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr className={busy ? "opacity-50" : ""}>
      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
        <span className="inline-flex items-center gap-1.5">
          {item.name}
          {/* Бүртгэлтэй — нэр, үсэг өөрчлөгдөхгүй, устгахгүй */}
          {inUse && (
            <span title={`${count} эд хөрөнгө бүртгэлтэй — нэр, үсэг өөрчлөгдөхгүй, устгахгүй`}>
              <Lock className="h-3.5 w-3.5 text-gray-400" strokeWidth={2} aria-label="Түгжээтэй" />
            </span>
          )}
        </span>
        {error && <p className="mt-1 text-theme-xs font-normal text-error-600 dark:text-error-400">{error}</p>}
      </td>
      <td className="px-5 py-3">
        {item.codeLetter ? (
          <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{item.codeLetter}</span>
        ) : (
          <span className="text-gray-400">Оноогоогүй</span>
        )}
      </td>
      <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-400">{count}</td>
      {(canEdit || canDelete) && (
        <td className="px-3 py-3">
          <div className="flex justify-end gap-1">
            {canEdit && !inUse && (
              <button
                type="button"
                onClick={startEdit}
                disabled={busy}
                aria-label={`${item.name} засах`}
                title="Засах"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <Pencil className="h-4 w-4" strokeWidth={1.8} />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={remove}
                disabled={busy || inUse}
                aria-label={`${item.name} устгах`}
                title={inUse ? `${count} эд хөрөнгө ашиглаж байгаа тул устгах боломжгүй` : "Устгах"}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-error-50 hover:text-error-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-500 dark:text-gray-400 dark:hover:bg-error-500/10 dark:hover:text-error-400"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

/** Нэг жагсаалт — Байршлын ангилал эсвэл Төрөл: нэр, үсэг, шинээр нэмэх */
function LetterList({
  kind,
  items,
  counts,
  canEdit,
  canDelete,
  onChange,
}: {
  kind: Kind;
  items: RefItem[];
  counts: Map<string, number>;
  canEdit: boolean;
  canDelete: boolean;
  onChange: (items: RefItem[]) => void;
}) {
  const text = KIND_TEXT[kind];
  const [name, setName] = useState("");
  const [letter, setLetter] = useState("");
  /** Хэрэглэгч үсгийг өөрөө бичсэн эсэх — бичээгүй бол нэрээс санал болгоно */
  const [letterTouched, setLetterTouched] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  /** Нэрээс санал болгох үсэг — Байршил, Төрөлд эхний үсэг; Нэрд үг бүрийн эхний үсэг */
  const suggested = kind === "name" ? initials(name) : initials(name).slice(0, 1);

  const effectiveLetter = letterTouched ? letter : suggested;
  const clash = findClash(items, null, name, effectiveLetter);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (clash) return;
    if (!name.trim()) {
      setError("Нэрийг оруулна уу.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const item = await addMetaItem(kind, name.trim(), (letterTouched ? letter : suggested).trim());
      onChange([...items, item]);
      setName("");
      setLetter("");
      setLetterTouched(false);
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
          Нэр ба {text.letter.toLowerCase()} — кодын {KIND_POSITION[kind]} орно. Үсгийг хоосон орхивол нэрийн эхний үсгээс автоматаар
        </p>
      </div>

      <table className="w-full text-left text-theme-sm">
        <thead>
          <tr className="text-theme-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <th className="px-5 py-2.5 font-medium">Нэр</th>
            <th className="px-5 py-2.5 font-medium">{text.letter}</th>
            <th className="px-5 py-2.5 text-right font-medium">Ширхэг</th>
            {(canEdit || canDelete) && <th className="w-20 px-3 py-2.5" aria-label="Үйлдэл" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
          {items.length === 0 && (
            <tr>
              <td colSpan={4} className="px-5 py-6 text-center text-gray-400">
                Бүртгэгдээгүй байна.
              </td>
            </tr>
          )}
          {items.map((item) => (
            <ItemRow
              key={item.id}
              kind={kind}
              item={item}
              items={items}
              count={counts.get(item.id) ?? 0}
              canEdit={canEdit}
              canDelete={canDelete}
              onSaved={(saved) =>
                onChange(items.map((row) => (row.id === saved.id ? { ...row, ...saved } : row)))
              }
              onDeleted={(id) => onChange(items.filter((row) => row.id !== id))}
            />
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
              value={letterTouched ? letter : suggested}
              onChange={(event) => {
                setLetterTouched(true);
                setLetter(event.target.value.toUpperCase());
              }}
              placeholder={text.letterPlaceholder}
              maxLength={8}
              aria-label={`Шинэ ${text.title.toLowerCase()} — ${text.letter}`}
              className={`${fieldClass} w-20 text-center font-mono font-semibold`}
            />
            <button
              type="submit"
              disabled={adding || !!clash}
              className={`${buttonClass} flex items-center gap-1`}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              {adding ? "..." : "Нэмэх"}
            </button>
          </div>
          {(clash || error) && (
            <p className="mt-1.5 text-theme-xs text-error-600 dark:text-error-400">{clash || error}</p>
          )}
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
  const isAdmin = isAdminRole(user?.role);
  const canEdit = isAdmin || (!!aimag && (user?.aimags ?? []).includes(aimag));
  /** Устгах нь системийн хэмжээнд зөвхөн админд */
  const canDelete = isAdmin;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [warehouses, setWarehouses] = useState<RefItem[]>([]);
  const [categories, setCategories] = useState<RefItem[]>([]);
  const [names, setNames] = useState<RefItem[]>([]);
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
      setNames(meta.names);
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
    const byName = new Map<string, number>();
    const nameIds = new Map(names.map((item) => [item.name, item.id]));
    for (const asset of assets) {
      if (asset.warehouseId) byWarehouse.set(asset.warehouseId, (byWarehouse.get(asset.warehouseId) ?? 0) + 1);
      if (asset.categoryId) byCategory.set(asset.categoryId, (byCategory.get(asset.categoryId) ?? 0) + 1);
      const nameId = nameIds.get(asset.name);
      if (nameId) byName.set(nameId, (byName.get(nameId) ?? 0) + 1);
    }
    return { byWarehouse, byCategory, byName };
  }, [assets, names]);

  /** Угтвар → «Байршил · Төрөл · Нэр» — кодын тоймд аль хослол болохыг харуулна */
  const prefixNames = useMemo(() => {
    const labels = new Map<string, string>();
    for (const warehouse of warehouses) {
      for (const category of categories) {
        const base = codePrefix(warehouse.codeLetter, category.codeLetter);
        if (base && !labels.has(base)) labels.set(base, `${warehouse.name} · ${category.name}`);
        for (const item of names) {
          const prefix = codePrefix(warehouse.codeLetter, category.codeLetter, item.codeLetter);
          if (prefix && !labels.has(prefix)) {
            labels.set(prefix, `${warehouse.name} · ${category.name} · ${item.name}`);
          }
        }
      }
    }
    return labels;
  }, [warehouses, categories, names]);

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
        Код = <b>Байршлын ангиллын эхний үсэг</b> + <b>Төрлийн 2 дахь үсэг</b> + <b>Нэрийн үсэг</b> + тоон
        дугаар. Жишээ нь Тайз (Т) + Гал тогоо (Г) + Аяга таваг (АТ) → <span className="font-mono">ТГАТ-001</span>.
        Эд хөрөнгө бүртгэхэд эдгээрийг сонгоход дараагийн код автоматаар үүснэ.
      </p>

      {loading && warehouses.length === 0 && categories.length === 0 && names.length === 0 ? (
        <p className="text-theme-sm text-gray-500">Ачаалж байна...</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <LetterList
            kind="warehouse"
            items={warehouses}
            counts={counts.byWarehouse}
            canEdit={canEdit}
            canDelete={canDelete}
            onChange={setWarehouses}
          />
          <LetterList
            kind="category"
            items={categories}
            counts={counts.byCategory}
            canEdit={canEdit}
            canDelete={canDelete}
            onChange={setCategories}
          />
          <LetterList
            kind="name"
            items={names}
            counts={counts.byName}
            canEdit={canEdit}
            canDelete={canDelete}
            onChange={setNames}
          />
        </div>
      )}

      {/* Бүртгэлтэй кодуудын тойм — угтвар бүрээр */}
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-gray-200 text-theme-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
              <th className="px-5 py-3.5 font-medium">Угтвар</th>
              <th className="px-5 py-3.5 font-medium">Байршил · Төрөл · Нэр</th>
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
