"use client";

import React, { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import {
  createCampaign,
  updateCampaign,
  campaignKindLabels,
  type Campaign,
  type CampaignInput,
  type CampaignKind,
} from "@/lib/campaigns";

type CampaignModalProps = {
  isOpen: boolean;
  /** null бол шинэ аян */
  campaign: Campaign | null;
  onClose: () => void;
  onSaved: (campaign: Campaign) => void;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

const empty: CampaignInput = {
  kind: "monthly",
  position: 0,
  featured: false,
  title: "",
  purpose: "",
  targetAmount: null,
  memoPrefix: "",
  endsOn: "",
  active: true,
};

/** Хандивын аян нээх / засах цонх — зөвхөн админ. */
export default function CampaignModal({
  isOpen,
  campaign,
  onClose,
  onSaved,
}: CampaignModalProps) {
  const [form, setForm] = useState<CampaignInput>(empty);
  /** Зорилтот дүнтэй эсэх — заавал биш */
  const [hasTarget, setHasTarget] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (campaign) {
      const { id: _id, createdAt: _createdAt, period: _period, ...rest } = campaign;
      void _id;
      void _createdAt;
      void _period;
      setForm(rest);
      setHasTarget(campaign.targetAmount !== null);
    } else {
      setForm(empty);
      setHasTarget(false);
    }
  }, [isOpen, campaign]);

  const set = <K extends keyof CampaignInput>(key: K, value: CampaignInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.title.trim()) return setError("Хандивын зорилгоо оруулна уу.");
    if (hasTarget && !form.targetAmount) return setError("Зорилтот дүнгээ оруулна уу.");

    const input = { ...form, targetAmount: hasTarget ? form.targetAmount : null };

    setSaving(true);
    setError(null);
    try {
      const saved = campaign
        ? await updateCampaign(campaign.id, input)
        : await createCampaign(input);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg p-0">
      <form onSubmit={handleSubmit} className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {campaign ? "Хандив засах" : "Хандив зарлах"}
        </h3>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className={labelClass}>Төрөл</p>
            <div className="flex gap-2">
              {(Object.keys(campaignKindLabels) as CampaignKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => set("kind", kind)}
                  aria-pressed={form.kind === kind}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-theme-sm font-medium transition-colors ${
                    form.kind === kind
                      ? "border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                  }`}
                >
                  {campaignKindLabels[kind]}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="campaign-title" className={labelClass}>
              Хандивын зорилго <span className="text-error-500">*</span>
            </label>
            <input
              id="campaign-title"
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
              maxLength={255}
              placeholder="Зорилго"
              className={fieldClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="campaign-purpose" className={labelClass}>
              Тайлбар
            </label>
            <textarea
              id="campaign-purpose"
              value={form.purpose}
              onChange={(event) => set("purpose", event.target.value)}
              rows={4}
              maxLength={5000}
              placeholder="Дэлгэрэнгүй тайлбар"
              className={`${fieldClass} h-auto py-2.5`}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={hasTarget}
                onChange={(event) => setHasTarget(event.target.checked)}
                className="h-4 w-4 accent-accent-600"
              />
              Зорилтот дүнтэй
            </label>
            {hasTarget && (
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={form.targetAmount ?? ""}
                onChange={(event) =>
                  set("targetAmount", Math.max(0, Math.trunc(Number(event.target.value) || 0)) || null)
                }
                placeholder="Дүн, ₮"
                aria-label="Зорилтот дүн, ₮"
                className={`${fieldClass} mt-2`}
              />
            )}
          </div>

          <div>
            <label htmlFor="campaign-memo" className={labelClass}>
              Гүйлгээний утга
            </label>
            <input
              id="campaign-memo"
              value={form.memoPrefix}
              onChange={(event) => set("memoPrefix", event.target.value)}
              maxLength={64}
              placeholder="Зорилго бичих"
              className={fieldClass}
            />
            <p className="mt-1 text-theme-xs text-gray-400">
              Хоосон бол хандивын зорилго. Ард нь өргөж буй хүний нэр залгагдана.
            </p>
          </div>

          {form.kind === "once" && (
          <div>
              <label htmlFor="campaign-ends" className={labelClass}>
                Дуусах огноо
              </label>
              <input
                id="campaign-ends"
                type="date"
                value={form.endsOn}
                onChange={(event) => set("endsOn", event.target.value)}
                className={fieldClass}
              />
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            Болих
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Хадгалж байна..." : "Хадгалах"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
