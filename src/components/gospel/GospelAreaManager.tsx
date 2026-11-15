"use client";

import React, { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import {
  createGospelArea,
  deleteGospelArea,
  renameGospelArea,
  type GospelArea,
} from "@/lib/gospel";

type GospelAreaManagerProps = {
  isOpen: boolean;
  areas: GospelArea[];
  onClose: () => void;
  /** Өөрчлөлт бүрийн дараа жагсаалтыг дахин ачаална */
  onChanged: () => Promise<void> | void;
};

const inputClass =
  "h-9 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90";

const iconButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-white/5 dark:hover:text-gray-200";

/**
 * «Сайн мэдээ»-ний таб ба задаргааг удирдах цонх — зөвхөн админ.
 * Бүртгэлтэй ангиллыг сервер хасахгүй, шалтгааныг нь энд харуулна.
 */
export default function GospelAreaManager({
  isOpen,
  areas,
  onClose,
  onChanged,
}: GospelAreaManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  /** Табын id → шинэ задаргааны ноорог; "" түлхүүр нь шинэ таб */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabs = areas.filter((area) => !area.parentId);
  const childrenOf = (id: string) => areas.filter((area) => area.parentId === id);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (parentId: string | null) => {
    const key = parentId ?? "";
    const name = (drafts[key] ?? "").trim();
    if (!name) return;

    const ok = await run(() => createGospelArea(name, parentId));
    if (ok) setDrafts((prev) => ({ ...prev, [key]: "" }));
  };

  const startEdit = (area: GospelArea) => {
    setEditingId(area.id);
    setEditName(area.name);
    setError(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    const ok = await run(() => renameGospelArea(editingId, editName.trim()));
    if (ok) setEditingId(null);
  };

  const remove = async (area: GospelArea) => {
    const isTab = !area.parentId;
    const message = isTab
      ? `«${area.name}» табыг задаргаатай нь хамт хасах уу?`
      : `«${area.name}» задаргааг хасах уу?`;
    if (!window.confirm(message)) return;

    await run(() => deleteGospelArea(area.id));
  };

  const renderRow = (area: GospelArea, isTab: boolean) =>
    editingId === area.id ? (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          saveEdit();
        }}
        className="flex items-center gap-1"
      >
        <input
          value={editName}
          onChange={(event) => setEditName(event.target.value)}
          maxLength={255}
          autoFocus
          aria-label="Шинэ нэр"
          className={inputClass}
        />
        <button type="submit" disabled={busy} aria-label="Хадгалах" className={iconButton}>
          <Check className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => setEditingId(null)}
          aria-label="Болих"
          className={iconButton}
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </form>
    ) : (
      <div className="flex items-center gap-1">
        <span
          className={`min-w-0 flex-1 text-theme-sm ${
            isTab
              ? "font-semibold text-gray-900 dark:text-white"
              : "text-gray-700 dark:text-gray-300"
          }`}
        >
          {area.name}
        </span>
        <button
          type="button"
          onClick={() => startEdit(area)}
          disabled={busy}
          aria-label={`«${area.name}»-ийн нэрийг засах`}
          className={iconButton}
        >
          <Pencil className="h-4 w-4" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={() => remove(area)}
          disabled={busy}
          aria-label={`«${area.name}»-ийг хасах`}
          className={`${iconButton} hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10`}
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>
    );

  const renderAdd = (parentId: string | null, placeholder: string) => {
    const key = parentId ?? "";
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          add(parentId);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={drafts[key] ?? ""}
          onChange={(event) =>
            setDrafts((prev) => ({ ...prev, [key]: event.target.value }))
          }
          maxLength={255}
          placeholder={placeholder}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={busy || !(drafts[key] ?? "").trim()}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Нэмэх
        </button>
      </form>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-xl p-0">
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Ангилал засах
        </h3>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Таб болон түүний задаргааг нэмж, нэрийг нь засаж, хасна. Бүртгэлтэй
          ангиллыг хасах боломжгүй.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}

        <div className="mt-5 flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="rounded-lg border border-gray-200 p-3 dark:border-white/10"
            >
              {renderRow(tab, true)}

              <ul className="mt-2 flex flex-col gap-1 border-l-2 border-gray-100 pl-3 dark:border-white/10">
                {childrenOf(tab.id).map((child) => (
                  <li key={child.id}>{renderRow(child, false)}</li>
                ))}
                <li className="pt-1">{renderAdd(tab.id, "Шинэ задаргаа")}</li>
              </ul>
            </div>
          ))}

          <div className="rounded-lg border border-dashed border-gray-300 p-3 dark:border-white/15">
            <p className="mb-2 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Шинэ таб
            </p>
            {renderAdd(null, "Жишээ нь: Сургуулийн сайн мэдээ")}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            Хаах
          </button>
        </div>
      </div>
    </Modal>
  );
}
