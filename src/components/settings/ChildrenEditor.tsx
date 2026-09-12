"use client";

import React, { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import { genders } from "@/data/profileOptions";
import { getChildren, saveChildren, type Child } from "@/lib/users";
import SettingsField from "./SettingsField";
import SettingsSelect from "./SettingsSelect";

type SaveState = "idle" | "saving" | "saved" | "error";

const emptyChild = (): Child => ({
  id: crypto.randomUUID(),
  name: "",
  birthDate: "",
  gender: "",
});

/** Хүүхдийн бүртгэлийг засах — тусдаа /api/users/me/children endpoint ашиглана. */
export default function ChildrenEditor() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    getChildren()
      .then(setChildren)
      .catch((err) => {
        console.error("Хүүхдийн бүртгэл ачаалахад алдаа гарлаа:", err);
        setError("Хүүхдийн бүртгэлийг ачаалж чадсангүй.");
      })
      .finally(() => setLoading(false));
  }, []);

  const update = (id: string, patch: Partial<Child>) => {
    setSaveState("idle");
    setChildren((prev) =>
      prev.map((child) => (child.id === id ? { ...child, ...patch } : child))
    );
  };

  const addChild = () => {
    setSaveState("idle");
    setChildren((prev) => [...prev, emptyChild()]);
  };

  const removeChild = (id: string) => {
    setSaveState("idle");
    setChildren((prev) => prev.filter((child) => child.id !== id));
  };

  const handleSave = async () => {
    setSaveState("saving");
    setError("");

    try {
      const saved = await saveChildren(children);
      setChildren(saved);
      setSaveState("saved");
    } catch (err) {
      console.error("Хүүхдийн бүртгэл хадгалахад алдаа гарлаа:", err);
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    }
  };

  if (loading) {
    return (
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">
        Ачаалж байна...
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        Хүүхдүүд
      </p>

      <div className="flex flex-col gap-4">
        {children.map((child) => (
          <div
            key={child.id}
            className="grid grid-cols-1 gap-3 rounded-lg border border-gray-100 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end dark:border-white/10"
          >
            <SettingsField
              id={`child-name-${child.id}`}
              label="Нэр"
              value={child.name}
              onChange={(value) => update(child.id, { name: value })}
            />
            <SettingsField
              id={`child-birth-${child.id}`}
              label="Төрсөн огноо"
              type="date"
              value={child.birthDate}
              onChange={(value) => update(child.id, { birthDate: value })}
            />
            <SettingsSelect
              id={`child-gender-${child.id}`}
              label="Хүйс"
              value={child.gender}
              options={genders}
              onChange={(value) => update(child.id, { gender: value })}
            />
            <button
              type="button"
              onClick={() => removeChild(child.id)}
              aria-label="Хүүхэд хасах"
              className="flex h-11 w-11 items-center justify-center self-end rounded-lg text-gray-400 transition-colors hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10 dark:hover:text-error-400"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addChild}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-gray-200 px-3.5 py-2 text-theme-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Хүүхэд нэмэх
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveState === "saving"}
          className="rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveState === "saving" ? "Хадгалж байна..." : "Хүүхдийн бүртгэл хадгалах"}
        </button>

        {saveState === "saved" && (
          <span className="text-theme-sm text-success-600 dark:text-success-400">
            Хадгаллаа
          </span>
        )}
        {saveState === "error" && (
          <span className="text-theme-sm text-error-500">{error}</span>
        )}
      </div>
    </div>
  );
}
