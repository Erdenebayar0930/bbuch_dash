"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  Check,
  Copy,
  HeartHandshake,
  Pencil,
  Plus,
  RotateCcw,
  Target,
  Trash2,
  XCircle,
} from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import CampaignModal from "@/components/finance/CampaignModal";
import { systemName } from "@/components/finance/TitheAccountCard";
import { CAMPAIGN_ACCOUNT, bankLabel, formatAccountNumber } from "@/data/donationAccounts";
import {
  campaignKindLabels,
  deleteCampaign,
  listCampaigns,
  updateCampaign,
  type Campaign,
} from "@/lib/campaigns";
import { copyToClipboard } from "@/lib/clipboard";
import { isAdminRole } from "@/lib/permissions";

const money = new Intl.NumberFormat("mn-MN");

const dateFormatter = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/** YYYY-MM-DD → уншигдах огноо (цагийн бүсээс хамаарахгүйгээр) */
const formatDate = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return y ? dateFormatter.format(new Date(y, m - 1, d)) : value;
};

const COPIED_MS = 2000;

/**
 * Санхүү → Хандив. Тухайн үед зарласан хандивын аянууд — зорилго, тайлбар,
 * гүйлгээний утга (нэг дарж хуулна), зорилтот дүн (заавал биш). Бүх хандив
 * нэг данс руу (`CAMPAIGN_ACCOUNT`) — данс нь хуудасны дээд хэсэгт нэг удаа.
 * Админ аян зарлаж, засаж, хааж, устгана; гишүүд нээлттэйг нь харна.
 */
export default function CampaignBoard() {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);
  const name = systemName(user?.first_name, user?.last_name);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCampaigns(await listCampaigns());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copy = async (value: string) => {
    if (await copyToClipboard(value)) {
      setCopied(value);
      window.setTimeout(
        () => setCopied((current) => (current === value ? null : current)),
        COPIED_MS
      );
    } else {
      setError("Хуулж чадсангүй — утгыг гараар бичнэ үү.");
    }
  };

  const saved = (campaign: Campaign) =>
    setCampaigns((prev) => {
      const exists = prev.some((item) => item.id === campaign.id);
      return exists
        ? prev.map((item) => (item.id === campaign.id ? campaign : item))
        : [campaign, ...prev];
    });

  const setActive = async (campaign: Campaign, active: boolean) => {
    try {
      saved(await updateCampaign(campaign.id, { active }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    }
  };

  const remove = async (campaign: Campaign) => {
    if (!window.confirm(`«${campaign.title}» хандивыг устгах уу?`)) return;
    try {
      await deleteCampaign(campaign.id);
      setCampaigns((prev) => prev.filter((item) => item.id !== campaign.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    }
  };

  const open = campaigns.filter((item) => item.active);
  const closed = campaigns.filter((item) => !item.active);

  const iconButton =
    "flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5";

  /**
   * Хандив өгөх алхам — дугаар, тайлбар, утга, хуулах товч нэг мөрөнд.
   * Хуулах товч нь өнгөтэй тул хүн юу хийхээ шууд олно.
   */
  const step = (
    index: number,
    label: string,
    display: string,
    value: string,
    hint?: string
  ) => {
    const isCopied = copied === value;
    return (
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-600 text-theme-xs font-bold text-white">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {label}
            {hint && <span className="hidden sm:inline"> · {hint}</span>}
          </p>
          <p className="truncate font-mono text-theme-sm font-bold text-gray-900 dark:text-white">
            {display}
          </p>
        </div>
        <button
          type="button"
          onClick={() => copy(value)}
          aria-label={`${label} хуулах`}
          className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-theme-xs font-semibold transition-colors ${
            isCopied
              ? "bg-success-600 text-white"
              : "bg-accent-600 text-white hover:bg-accent-700"
          }`}
        >
          {isCopied ? (
            <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
          ) : (
            <Copy className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          {isCopied ? "Хуулагдлаа" : "Хуулах"}
        </button>
      </div>
    );
  };

  const renderCard = (campaign: Campaign) => {
    const memo = `${campaign.memoPrefix || campaign.title}-${name}`;

    return (
      <article
        key={campaign.id}
        className={`relative overflow-hidden rounded-2xl border shadow-sm ${
          campaign.active
            ? "border-accent-200 bg-gradient-to-br from-accent-50 via-white to-white dark:border-accent-500/30 dark:from-accent-500/15 dark:via-transparent dark:to-transparent"
            : "border-gray-200 bg-white opacity-70 grayscale dark:border-white/10 dark:bg-white/[0.03]"
        }`}
      >
        {/* Толгой — зорилго, дүн, огноо */}
        <div className="flex items-start gap-3 px-4 pt-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-600 text-white shadow-sm">
            <HeartHandshake className="h-5 w-5" strokeWidth={1.8} />
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold leading-snug text-gray-900 dark:text-white">
              {campaign.title}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-gray-900 px-2 py-0.5 text-theme-xs font-semibold text-white dark:bg-white dark:text-gray-900">
                {campaignKindLabels[campaign.kind]}
              </span>
              {campaign.targetAmount !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-600/10 px-2 py-0.5 text-theme-xs font-semibold text-accent-700 dark:text-accent-300">
                  <Target className="h-3 w-3" strokeWidth={2} />
                  Зорилт {money.format(campaign.targetAmount)}₮
                </span>
              )}
              {campaign.endsOn && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-500/10 px-2 py-0.5 text-theme-xs font-medium text-warning-700 dark:text-warning-400">
                  <CalendarClock className="h-3 w-3" strokeWidth={2} />
                  {formatDate(campaign.endsOn)} хүртэл
                </span>
              )}
              {!campaign.active && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-theme-xs text-gray-500 dark:bg-white/10 dark:text-gray-400">
                  Дууссан
                </span>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="flex gap-0.5">
              <button
                type="button"
                onClick={() => {
                  setEditing(campaign);
                  setModalOpen(true);
                }}
                aria-label="Засах"
                title="Засах"
                className={iconButton}
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => setActive(campaign, !campaign.active)}
                aria-label={campaign.active ? "Хаах" : "Дахин нээх"}
                title={campaign.active ? "Хаах" : "Дахин нээх"}
                className={iconButton}
              >
                {campaign.active ? (
                  <XCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
                )}
              </button>
              <button
                type="button"
                onClick={() => remove(campaign)}
                aria-label="Устгах"
                title="Устгах"
                className={`${iconButton} hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10`}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </div>
          )}
        </div>

        {campaign.purpose && (
          <p
            className="line-clamp-2 px-4 pt-2 text-theme-sm text-gray-600 dark:text-gray-300"
            title={campaign.purpose}
          >
            {campaign.purpose}
          </p>
        )}

        {/* Хандив өгөх алхмууд — данс, утга доор доороо */}
        <div className="m-4 mt-3 flex flex-col gap-2.5 rounded-xl border border-white/60 bg-white/80 p-3 shadow-xs backdrop-blur dark:border-white/10 dark:bg-gray-900/60">
          {step(
            1,
            "Дансны дугаар",
            formatAccountNumber(CAMPAIGN_ACCOUNT.number),
            CAMPAIGN_ACCOUNT.number,
            `${bankLabel(CAMPAIGN_ACCOUNT.bank)} · ${CAMPAIGN_ACCOUNT.holder}`
          )}
          {name ? (
            step(2, "Гүйлгээний утга", memo, memo)
          ) : (
            <p className="text-theme-xs text-warning-700 dark:text-warning-400">
              Гүйлгээний утга гарахын тулд профайлд нэрээ бөглөнө үү.
            </p>
          )}
          <p className="flex items-center gap-3 text-theme-xs text-gray-500 dark:text-gray-400">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-600/15 font-bold text-accent-700 dark:text-accent-300">
              3
            </span>
            Банкны аппаараа шилжүүлээд хандиваа өгнө
          </p>
        </div>

        {/* Улаан уриа — картын доод хэсэгт, хүн юу хийхээ шууд ойлгоно */}
        {campaign.active && (
          <div className="flex items-center justify-center gap-2 bg-error-600 px-4 py-2.5 text-theme-sm font-bold uppercase tracking-wide text-white">
            <HeartHandshake className="h-4 w-4" strokeWidth={2.2} />
            Хандив өргөх
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-4 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            Хандив зарлах
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      {loading && campaigns.length === 0 && (
        <p className="py-8 text-center text-theme-sm text-gray-500">Ачаалж байна...</p>
      )}

      {!loading && open.length === 0 && (
        <p className="surface px-4 py-10 text-center text-theme-sm text-gray-400">
          Одоогоор зарласан хандив алга.
        </p>
      )}

      {open.map(renderCard)}

      {isAdmin && closed.length > 0 && (
        <>
          <p className="mt-2 text-theme-sm font-medium text-gray-500 dark:text-gray-400">
            Дууссан хандив
          </p>
          {closed.map(renderCard)}
        </>
      )}

      {isAdmin && (
        <CampaignModal
          isOpen={modalOpen}
          campaign={editing}
          onClose={() => setModalOpen(false)}
          onSaved={saved}
        />
      )}
    </div>
  );
}
