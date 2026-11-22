"use client";

import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { Boxes, Search } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { assetStateLabels, assetStateStyles, type AssetState } from "@/data/assetStates";
import { updateAsset, type Asset } from "@/lib/assets";

type UsageRegisterModalProps = {
  isOpen: boolean;
  /** Хайх боломжтой бүх эд хөрөнгө (тухайн аймгийнх) */
  assets: Asset[];
  onClose: () => void;
  onSaved: () => void;
};

/** Ашиглалтын байдлаар бүртгэх сонголтууд — Акталсныг энд оноохгүй */
const USAGE_OPTIONS: { state: AssetState; label: string }[] = [
  { state: "in_use", label: "Ашиглалтад гаргах" },
  { state: "repair", label: "Засварт өгөх" },
  { state: "registered", label: "Агуулахад буцаах" },
];

/** Хэсэгчлэн таарсныг хэт олноор харуулахгүй */
const MAX_MATCHES = 8;

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass = "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

const norm = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");

/**
 * «Ашиглалт бүртгэх» — эхлээд кодоор хайж бараагаа олно, дараа нь ашиглалтын
 * байдлыг (Ашиглалтад / Засварт / Агуулахад буцаах) ба мэдээллийг бүртгэнэ.
 * Өөрчлөлт бүр ширхэгийн түүхэнд үлдэнэ (@see api/assets/[id] PATCH).
 */
export default function UsageRegisterModal({ isOpen, assets, onClose, onSaved }: UsageRegisterModalProps) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [matches, setMatches] = useState<Asset[]>([]);
  const [found, setFound] = useState<Asset | null>(null);
  const [state, setState] = useState<AssetState>("in_use");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSearched(false);
    setMatches([]);
    setFound(null);
    setError("");
  }, [isOpen]);

  const choose = (asset: Asset) => {
    setFound(asset);
    setMatches([]);
    setNote(asset.note);
    // Одоо ашиглалтад байгаа бол дараагийн алхам нь ихэвчлэн буцаах
    setState(asset.state === "in_use" ? "registered" : "in_use");
    setError("");
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const key = norm(query);
    setSearched(true);
    setFound(null);
    setError("");
    if (!key) {
      setMatches([]);
      return;
    }
    const coded = assets.filter((asset) => asset.code);
    const exact = coded.find((asset) => norm(asset.code) === key);
    if (exact) {
      choose(exact);
      return;
    }
    const partial = coded.filter((asset) => norm(asset.code).includes(key)).slice(0, MAX_MATCHES);
    if (partial.length === 1) {
      choose(partial[0]);
      return;
    }
    setMatches(partial);
  };

  const reset = () => {
    setFound(null);
    setSearched(false);
    setQuery("");
    setMatches([]);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    if (!found) return;
    setSaving(true);
    setError("");
    try {
      await updateAsset(found.id, { state, note: note.trim() });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Бүртгэж чадсангүй.");
    } finally {
      setSaving(false);
    }
  };

  const writtenOff = found?.state === "written_off";

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg p-0">
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Ашиглалт бүртгэх</h3>

        {/* 1. Код оруулж хайна */}
        <form onSubmit={handleSearch} className="mt-5">
          <label htmlFor="usage-code" className={labelClass}>
            Код
          </label>
          <div className="flex gap-2">
            <input
              id="usage-code"
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value.toUpperCase())}
              placeholder="Жишээ нь: ДХГ-АШ001"
              autoFocus
              autoComplete="off"
              className={`${fieldClass} font-mono`}
            />
            <button
              type="submit"
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-accent-600 px-4 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700"
            >
              <Search className="h-4 w-4" strokeWidth={2} />
              Хайх
            </button>
          </div>
        </form>

        {/* Хэсэгчлэн таарсан — сонгоно */}
        {matches.length > 0 && (
          <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-white/5 dark:border-white/10">
            {matches.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => choose(asset)}
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-theme-sm hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{asset.code}</span>
                  <span className="min-w-0 flex-1 truncate text-gray-600 dark:text-gray-400">{asset.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${assetStateStyles[asset.state]}`}>
                    {assetStateLabels[asset.state]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {searched && !found && matches.length === 0 && query.trim() && (
          <p className="mt-3 rounded-lg bg-gray-50 px-3.5 py-3 text-theme-sm text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
            «{query.trim()}» кодтой бараа олдсонгүй.
          </p>
        )}

        {/* 2. Олдсон бараа */}
        {found && (
          <>
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-white/10">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-white/5">
                {found.images.length > 0 ? (
                  <Image src={found.images[0].url} alt="" width={56} height={56} className="h-full w-full object-cover" />
                ) : (
                  <Boxes className="h-5 w-5 text-gray-400" strokeWidth={1.8} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-theme-sm font-semibold text-gray-900 dark:text-white">{found.code}</p>
                <p className="truncate text-theme-sm text-gray-700 dark:text-gray-300">{found.name}</p>
                <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                  {[found.warehouseName, found.categoryName].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${assetStateStyles[found.state]}`}>
                {assetStateLabels[found.state]}
              </span>
            </div>

            {writtenOff ? (
              <p className="mt-3 rounded-lg bg-warning-50 px-3.5 py-3 text-theme-sm text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
                Энэ бараа акталсан тул ашиглалтад бүртгэх боломжгүй.
              </p>
            ) : (
              /* 3. Ашиглалтын байдлыг бүртгэнэ */
              <div className="mt-4 grid gap-4">
                <div>
                  <span className={labelClass}>Ашиглалтын байдал</span>
                  <div role="radiogroup" aria-label="Ашиглалтын байдал" className="flex flex-wrap gap-1.5">
                    {USAGE_OPTIONS.map((option) => {
                      const selected = state === option.state;
                      return (
                        <button
                          key={option.state}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setState(option.state)}
                          className={`h-9 rounded-lg px-3.5 text-theme-sm font-medium transition-colors ${
                            selected
                              ? "bg-accent-600 text-white"
                              : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="usage-note" className={labelClass}>
                    Мэдээлэл <span className="text-gray-400">(хэнд, хаана, ямар зорилгоор …)</span>
                  </label>
                  <textarea
                    id="usage-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    className={`${fieldClass} h-auto py-2.5`}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          {found && (
            <button
              type="button"
              onClick={reset}
              className="mr-auto rounded-lg px-3 py-2.5 text-theme-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5"
            >
              Өөр код хайх
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            Буцах
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!found || writtenOff || saving}
            className="rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Бүртгэж байна..." : "Бүртгэх"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
