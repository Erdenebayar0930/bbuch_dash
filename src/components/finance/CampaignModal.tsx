"use client";

import React, { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { campaignBoards, type CampaignBoardKey } from "@/data/campaignBoards";
import { CAMPAIGN_ACCOUNT, bankLabel, formatAccountNumber } from "@/data/donationAccounts";
import { useDonationAccounts } from "@/hooks/useDonationAccounts";
import { aimags as aimagOptions } from "@/data/profileOptions";
import {
  createCampaign,
  updateCampaign,
  campaignKindLabels,
  type Campaign,
  type CampaignInput,
  type CampaignKind,
} from "@/lib/campaigns";
import DateInput from "@/components/form/DateInput";

type CampaignModalProps = {
  isOpen: boolean;
  /** null бол шинэ аян */
  campaign: Campaign | null;
  onClose: () => void;
  onSaved: (campaign: Campaign) => void;
  /** Хандив эсвэл Өглөг — Өглөг нь зөвхөн нэг удаагийнх */
  board?: CampaignBoardKey;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

const empty: CampaignInput = {
  kind: "monthly",
  position: 0,
  featured: false,
  aimags: [],
  title: "",
  purpose: "",
  targetAmount: null,
  memoPrefix: "",
  accountBank: "",
  accountNumber: "",
  accountHolder: "",
  endsOn: "",
  active: true,
  notifyDay: 1,
  notifyTime: "09:00",
};

/** «Хэнээс» сонголтын товч */
const chipClass = (selected: boolean) =>
  `rounded-lg border px-3 py-2 text-theme-sm font-medium transition-colors ${
    selected
      ? "border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
  }`;

const DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

/** Хандивын аян нээх / засах цонх — аль ч гишүүн зарлана, өөрийнхөө засна. */
export default function CampaignModal({
  isOpen,
  campaign,
  onClose,
  onSaved,
  board = "donation",
}: CampaignModalProps) {
  const info = campaignBoards[board];
  const Genitive = info.genitive.charAt(0).toUpperCase() + info.genitive.slice(1);
  const [form, setForm] = useState<CampaignInput>(empty);
  const { accounts } = useDonationAccounts();
  /** Зорилтот дүнтэй эсэх — заавал биш */
  const [hasTarget, setHasTarget] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (campaign) {
      const {
        id: _id,
        createdAt: _createdAt,
        period: _period,
        status: _status,
        reviewNote: _reviewNote,
        createdBy: _createdBy,
        ...rest
      } = campaign;
      void _createdBy;
      void _id;
      void _createdAt;
      void _period;
      void _status;
      void _reviewNote;
      setForm(rest);
      setHasTarget(campaign.targetAmount !== null);
    } else {
      setForm(info.onceOnly ? { ...empty, kind: "once" } : empty);
      setHasTarget(false);
    }
  }, [isOpen, campaign, info.onceOnly]);

  const set = <K extends keyof CampaignInput>(key: K, value: CampaignInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleAimag = (key: string) =>
    setForm((prev) => ({
      ...prev,
      aimags: prev.aimags.includes(key)
        ? prev.aimags.filter((item) => item !== key)
        : [...prev.aimags, key],
    }));

  /** «бүх гишүүнд» эсвэл «Харуулын аймаг, Магтаалын аймгийн гишүүдэд» */
  const audienceText =
    form.aimags.length === 0
      ? "бүх гишүүнд"
      : `${aimagOptions
          .filter((option) => form.aimags.includes(option.value))
          .map((option) => option.label)
          .join(", ")}-ийн гишүүдэд`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.title.trim()) return setError(`${Genitive} зорилгоо оруулна уу.`);
    if (hasTarget && !form.targetAmount) return setError("Зорилтот дүнгээ оруулна уу.");
    if (info.ownAccount && !form.accountNumber.trim()) {
      return setError("Дансны дугаараа оруулна уу.");
    }

    const input = { ...form, targetAmount: hasTarget ? form.targetAmount : null };

    setSaving(true);
    setError(null);
    try {
      const saved = campaign
        ? await updateCampaign(campaign.id, input)
        : await createCampaign(input, board);
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
          {campaign ? `${info.title} засах` : info.create}
        </h3>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {!info.onceOnly && (
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
          )}

          <div className="sm:col-span-2">
            <label htmlFor="campaign-title" className={labelClass}>
              {Genitive} зорилго <span className="text-error-500">*</span>
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
            <p className={labelClass}>Хэнээс</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Хэнээс хандив авах">
              <button
                type="button"
                onClick={() => set("aimags", [])}
                aria-pressed={form.aimags.length === 0}
                className={chipClass(form.aimags.length === 0)}
              >
                Хүн бүрээс
              </button>
              {aimagOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleAimag(option.value)}
                  aria-pressed={form.aimags.includes(option.value)}
                  className={chipClass(form.aimags.includes(option.value))}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-theme-xs text-gray-400">
              Сонгосон хүмүүст л харагдаж, мэдэгдэл очно. Аймаг сонгоогүй бол бүх гишүүнд.
            </p>
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

          {/* Өглөг — данс заавал; Хандив — заавал биш, хоосон бол нийтлэг данс */}
          <>
              {!info.ownAccount && (
                <p className="text-theme-xs text-gray-500 sm:col-span-2 dark:text-gray-400">
                  Дансны мэдээлэл — хоосон орхивол үндсэн данс (
                  {bankLabel(CAMPAIGN_ACCOUNT.bank)} ·{" "}
                  {formatAccountNumber(CAMPAIGN_ACCOUNT.number)}) харагдана.
                </p>
              )}
              {accounts.length > 0 && (
                <div className="sm:col-span-2">
                  <label htmlFor="campaign-saved-account" className={labelClass}>
                    Бүртгэлтэй данснаас сонгох
                  </label>
                  <select
                    id="campaign-saved-account"
                    value={
                      accounts.find(
                        (item) => item.number === form.accountNumber.replace(/[\s-]/g, "").toUpperCase()
                      )?.id ?? ""
                    }
                    onChange={(event) => {
                      const picked = accounts.find((item) => item.id === event.target.value);
                      setForm((prev) => ({
                        ...prev,
                        accountNumber: picked?.number ?? "",
                        accountBank: picked ? bankLabel(picked.bank) : "",
                        accountHolder: picked?.holder ?? "",
                      }));
                    }}
                    className={fieldClass}
                  >
                    <option value="">— Гараар оруулах —</option>
                    {accounts.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} · {formatAccountNumber(item.number)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="campaign-bank" className={labelClass}>
                  Банк
                </label>
                <input
                  id="campaign-bank"
                  list="campaign-bank-options"
                  value={form.accountBank}
                  onChange={(event) => set("accountBank", event.target.value)}
                  maxLength={64}
                  placeholder="Хаан банк"
                  className={fieldClass}
                />
                <datalist id="campaign-bank-options">
                  <option value="Хаан банк" />
                  <option value="Төрийн банк" />
                  <option value="Голомт банк" />
                  <option value="Худалдаа хөгжлийн банк" />
                  <option value="Хас банк" />
                  <option value="Капитрон банк" />
                </datalist>
              </div>
              <div>
                <label htmlFor="campaign-holder" className={labelClass}>
                  Данс эзэмшигч
                </label>
                <input
                  id="campaign-holder"
                  value={form.accountHolder}
                  onChange={(event) => set("accountHolder", event.target.value)}
                  maxLength={255}
                  placeholder="Овог нэр"
                  className={fieldClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="campaign-account" className={labelClass}>
                  Дансны дугаар{" "}
                  {info.ownAccount && <span className="text-error-500">*</span>}
                </label>
                <input
                  id="campaign-account"
                  value={form.accountNumber}
                  onChange={(event) => set("accountNumber", event.target.value)}
                  maxLength={64}
                  placeholder="MN00 0000 0000 0000 0000"
                  className={`${fieldClass} font-mono`}
                />
              </div>
          </>

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
              Хоосон бол {info.genitive} зорилго. Ард нь өгч буй хүний нэр залгагдана.
            </p>
          </div>

          {form.kind === "once" && (
          <div>
              <label htmlFor="campaign-ends" className={labelClass}>
                Дуусах огноо
              </label>
              <DateInput
                id="campaign-ends"
                value={form.endsOn}
                onChange={(event) => set("endsOn", event.target.value)}
                className={fieldClass}
              />
            </div>
          )}

          {form.kind === "monthly" && (
            <div className="sm:col-span-2">
              <p className={labelClass}>Сар бүрийн сануулга</p>
              <div className="flex flex-wrap items-center gap-2 text-theme-sm text-gray-600 dark:text-gray-300">
                Сар бүрийн
                <select
                  value={form.notifyDay}
                  onChange={(event) => set("notifyDay", Number(event.target.value))}
                  aria-label="Сануулах өдөр"
                  className={`${fieldClass} w-20`}
                >
                  {DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
                -нд
                <input
                  type="time"
                  value={form.notifyTime}
                  onChange={(event) => set("notifyTime", event.target.value || "09:00")}
                  aria-label="Сануулах цаг"
                  className={`${fieldClass} w-32`}
                />
                цагт {audienceText} мэдэгдэл очно
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-theme-xs text-gray-500 dark:bg-white/5 dark:text-gray-400">
          {campaign
            ? "Зорилго, тайлбар, дүн зэргийг өөрчилбөл дахин зөвшөөрөл хүлээнэ."
            : `Зөвшөөрөгч зөвшөөрсний дараа ${audienceText} харагдаж, мэдэгдэл очно.`}
        </p>

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
