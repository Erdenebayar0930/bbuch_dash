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
  ArrowDown,
  ArrowUp,
  Bell,
  CheckCircle2,
  Clock,
  MessageSquareWarning,
  Star,
  UserCog,
} from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import CampaignApproversModal from "@/components/finance/CampaignApproversModal";
import CampaignModal from "@/components/finance/CampaignModal";
import { systemName } from "@/components/finance/TitheAccountCard";
import { campaignBoards, type CampaignBoardKey } from "@/data/campaignBoards";
import { CAMPAIGN_ACCOUNT, bankLabel, formatAccountNumber } from "@/data/donationAccounts";
import {
  campaignKindLabels,
  campaignStatusLabels,
  deleteCampaign,
  listCampaigns,
  reviewCampaign,
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
type CampaignBoardProps = {
  /** Хандив (анхдагч) эсвэл Өглөг — Өглөг нь нэг удаагийнх, табууд нь Идэвхтэй | Дууссан */
  board?: CampaignBoardKey;
};

export default function CampaignBoard({ board = "donation" }: CampaignBoardProps) {
  const info = campaignBoards[board];
  /** Хаах товчны нэр — Өглөг: «Өгсөн болгох» */
  const closeLabel = info.ownAccount ? "Өгсөн болгох" : "Хаах";
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);
  const name = systemName(user?.first_name, user?.last_name);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  /** Сар бүр | Нэг удаа | Дууссан | Хүлээгдэж буй */
  const [tab, setTab] = useState<"monthly" | "once" | "ended" | "review">(
    info.onceOnly ? "once" : "monthly"
  );
  /** Дуудагч зөвшөөрөх эрхтэй эсэх — серверээс */
  const [canApprove, setCanApprove] = useState(false);
  const [approversOpen, setApproversOpen] = useState(false);
  /** «Өөрчлүүлэх» тайлбар бичиж буй хандив */
  const [returning, setReturning] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCampaigns(board);
      setCampaigns(data.campaigns);
      setCanApprove(data.canApprove);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, [board]);

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
      const next = exists
        ? prev.map((item) => (item.id === campaign.id ? campaign : item))
        : [...prev, campaign];
      return sortCampaigns(next);
    });

  const setActive = async (campaign: Campaign, active: boolean) => {
    try {
      saved(await updateCampaign(campaign.id, { active }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    }
  };

  const remove = async (campaign: Campaign) => {
    if (!window.confirm(`«${campaign.title}» ${info.accusative} устгах уу?`)) return;
    try {
      await deleteCampaign(campaign.id);
      setCampaigns((prev) => prev.filter((item) => item.id !== campaign.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    }
  };

  /** Онцлох → эрэмбэ → шинэ нь — сервертэй ижил дараалал */
  function sortCampaigns(list: Campaign[]) {
    return [...list].sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        a.position - b.position ||
        b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  // Өглөг дээр зөвшөөрөгдөөгүй нь тусдаа «Хүлээгдэж буй» табд; Хандив дээр
  // тийм таб байхгүй — төрлийнхөө табд «Зөвшөөрөл хүлээж буй» тэмдэгтэй
  // харагдана (сервер зөвхөн админ, зөвшөөрөгчид л илгээнэ)
  const reviewTab = info.onceOnly && (isAdmin || canApprove);
  const listed = reviewTab ? campaigns.filter((c) => c.status === "approved") : campaigns;
  const tabs = [
    // Өглөг нь нэг удаагийнх тул «Сар бүр» табгүй, нээлттэй нь «Идэвхтэй»
    ...(info.onceOnly
      ? []
      : [{ key: "monthly" as const, label: "Сар бүр", items: listed.filter((c) => c.active && c.kind === "monthly") }]),
    {
      key: "once" as const,
      label: info.openLabel,
      items: listed.filter((c) => c.active && (info.onceOnly || c.kind === "once")),
    },
    { key: "ended" as const, label: info.closedLabel, items: listed.filter((c) => !c.active) },
    ...(reviewTab
      ? [{ key: "review" as const, label: "Хүлээгдэж буй", items: campaigns.filter((c) => c.status !== "approved") }]
      : []),
  ];

  const review = async (campaign: Campaign, action: "approve" | "changes") => {
    if (action === "changes" && !note.trim()) {
      setError("Юуг өөрчлөхийг тайлбарт бичнэ үү.");
      return;
    }
    setReviewing(true);
    setError(null);
    try {
      saved(
        await reviewCampaign(
          campaign.id,
          action === "approve" ? { action } : { action, note: note.trim() }
        )
      );
      setReturning(null);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setReviewing(false);
    }
  };
  const visible = tabs.find((item) => item.key === tab)?.items ?? [];

  const toggleFeatured = async (campaign: Campaign) => {
    try {
      saved(await updateCampaign(campaign.id, { featured: !campaign.featured }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    }
  };

  /**
   * Эрэмбийг нэг алхам зөөнө — тухайн таб доторх хөршөөрөө байраа солино.
   * Онцлох нь үргэлж дээрээ тул зөвхөн ижил онцлох төлөвтэйтэйгээ солигдоно.
   */
  const move = async (campaign: Campaign, direction: -1 | 1) => {
    const peers = visible.filter((item) => item.featured === campaign.featured);
    const index = peers.findIndex((item) => item.id === campaign.id);
    const other = peers[index + direction];
    if (!other) return;

    // Ижил эрэмбэтэй бол ялгаатай болгоно
    const a = other.position;
    const b = campaign.position === other.position ? other.position + direction : campaign.position;
    try {
      const [first, second] = await Promise.all([
        updateCampaign(campaign.id, { position: a }),
        updateCampaign(other.id, { position: b }),
      ]);
      saved(first);
      saved(second);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Эрэмбэ хадгалахад алдаа гарлаа.");
    }
  };

  const periodLabel = (period: string) => {
    const [year, month] = period.split("-").map(Number);
    return year ? `${year} оны ${month}-р сар` : "";
  };

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
    // Өглөг — өөрийн данс; Хандив — нэг нийтлэг данс
    const account = info.ownAccount
      ? {
          number: campaign.accountNumber.replace(/\s+/g, ""),
          hint: [campaign.accountBank, campaign.accountHolder].filter(Boolean).join(" · "),
        }
      : {
          number: CAMPAIGN_ACCOUNT.number,
          hint: `${bankLabel(CAMPAIGN_ACCOUNT.bank)} · ${CAMPAIGN_ACCOUNT.holder}`,
        };

    return (
      <article
        key={campaign.id}
        className={`relative overflow-hidden rounded-2xl border shadow-sm ${
          campaign.featured && campaign.active ? "ring-2 ring-warning-400" : ""
        } ${
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
              {campaign.featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-500 px-2 py-0.5 text-theme-xs font-bold text-white">
                  <Star className="h-3 w-3 fill-current" strokeWidth={2} />
                  Онцлох
                </span>
              )}
              <span className="rounded-full bg-gray-900 px-2 py-0.5 text-theme-xs font-semibold text-white dark:bg-white dark:text-gray-900">
                {campaignKindLabels[campaign.kind]}
                {campaign.kind === "monthly" && campaign.period && ` · ${periodLabel(campaign.period)}`}
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
              {campaign.status !== "approved" && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-theme-xs font-semibold ${
                    campaign.status === "changes"
                      ? "bg-error-500/10 text-error-700 dark:text-error-400"
                      : "bg-warning-500/10 text-warning-700 dark:text-warning-400"
                  }`}
                >
                  {campaign.status === "changes" ? (
                    <MessageSquareWarning className="h-3 w-3" strokeWidth={2} />
                  ) : (
                    <Clock className="h-3 w-3" strokeWidth={2} />
                  )}
                  {campaignStatusLabels[campaign.status]}
                </span>
              )}
              {(isAdmin || canApprove) && campaign.kind === "monthly" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-theme-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">
                  <Bell className="h-3 w-3" strokeWidth={2} />
                  Сар бүрийн {campaign.notifyDay}-нд {campaign.notifyTime}
                </span>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="flex flex-wrap justify-end gap-0.5">
              <button
                type="button"
                onClick={() => toggleFeatured(campaign)}
                aria-label={campaign.featured ? "Онцлохоос хасах" : "Онцлох болгох"}
                title={campaign.featured ? "Онцлохоос хасах" : "Онцлох болгох"}
                className={`${iconButton} ${campaign.featured ? "text-warning-500" : ""}`}
              >
                <Star
                  className={`h-3.5 w-3.5 ${campaign.featured ? "fill-current" : ""}`}
                  strokeWidth={1.8}
                />
              </button>
              <button
                type="button"
                onClick={() => move(campaign, -1)}
                aria-label="Дээш"
                title="Дээш"
                className={iconButton}
              >
                <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => move(campaign, 1)}
                aria-label="Доош"
                title="Доош"
                className={iconButton}
              >
                <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
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
                aria-label={campaign.active ? closeLabel : "Дахин нээх"}
                title={campaign.active ? closeLabel : "Дахин нээх"}
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

        {/* Өөрчлүүлэх тайлбар — зарласан админд харагдана */}
        {campaign.status === "changes" && campaign.reviewNote && (
          <p className="mx-4 mt-3 whitespace-pre-line rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
            <span className="font-semibold">Өөрчлөх зүйл: </span>
            {campaign.reviewNote}
          </p>
        )}

        {/* Зөвшөөрөх / Өөрчлүүлэх — зөвшөөрөгчид */}
        {canApprove && campaign.status !== "approved" && (
          <div className="mx-4 mt-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-gray-900/60">
            {returning === campaign.id ? (
              <div className="flex flex-col gap-2">
                <textarea
                  autoFocus
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Юуг өөрчлөх вэ?"
                  aria-label="Өөрчлүүлэх тайлбар"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReturning(null);
                      setNote("");
                    }}
                    className="h-9 rounded-lg px-3 text-theme-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    Болих
                  </button>
                  <button
                    type="button"
                    disabled={reviewing}
                    onClick={() => review(campaign, "changes")}
                    className="h-9 rounded-lg bg-error-600 px-3.5 text-theme-sm font-semibold text-white hover:bg-error-700 disabled:opacity-60"
                  >
                    Буцаах
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() => review(campaign, "approve")}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-success-600 px-3.5 text-theme-sm font-semibold text-white hover:bg-success-700 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                  Зөвшөөрөх
                </button>
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() => {
                    setReturning(campaign.id);
                    setNote("");
                  }}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-error-300 px-3.5 text-theme-sm font-semibold text-error-600 hover:bg-error-50 disabled:opacity-60 dark:border-error-500/40 dark:hover:bg-error-500/10"
                >
                  <MessageSquareWarning className="h-4 w-4" strokeWidth={2} />
                  Өөрчлүүлэх
                </button>
              </div>
            )}
          </div>
        )}

        {/* Хандив өгөх алхмууд — данс, утга доор доороо (нээлттэйд л) */}
        {campaign.active ? (
        <div className="m-4 mt-3 flex flex-col gap-2.5 rounded-xl border border-white/60 bg-white/80 p-3 shadow-xs backdrop-blur dark:border-white/10 dark:bg-gray-900/60">
          {account.number ? (
            step(
              1,
              "Дансны дугаар",
              formatAccountNumber(account.number),
              account.number,
              account.hint || undefined
            )
          ) : (
            <p className="text-theme-xs text-warning-700 dark:text-warning-400">
              Дансны мэдээлэл оруулаагүй байна.
            </p>
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
            Банкны аппаараа шилжүүлээд {info.reflexive} өгнө
          </p>
        </div>
        ) : (
          <div className="h-4" />
        )}

        {/* Улаан уриа — картын доод хэсэгт, хүн юу хийхээ шууд ойлгоно */}
        {campaign.active && (
          <div className="flex items-center justify-center gap-2 bg-error-600 px-4 py-2.5 text-theme-sm font-bold uppercase tracking-wide text-white">
            <HeartHandshake className="h-4 w-4" strokeWidth={2.2} />
            {info.cta}
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setApproversOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            <UserCog className="h-4 w-4" strokeWidth={1.8} />
            Зөвшөөрөгчид
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-4 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            {info.create}
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

      {/* Сар бүр | Нэг удаа | Дууссан */}
      <div
        role="tablist"
        aria-label={`${info.title} — ангилал`}
        className="flex flex-wrap gap-x-1 border-b border-gray-200 dark:border-white/10"
      >
        {tabs.map((item) => {
          const selected = item.key === tab;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(item.key)}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-theme-sm font-medium transition-colors ${
                selected
                  ? "border-accent-600 text-accent-700 dark:border-accent-400 dark:text-accent-300"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {item.label}
              <span className="rounded-full bg-gray-100 px-1.5 text-theme-xs text-gray-500 dark:bg-white/10 dark:text-gray-400">
                {item.items.length}
              </span>
            </button>
          );
        })}
      </div>

      {!loading && visible.length === 0 && (
        <p className="surface px-4 py-10 text-center text-theme-sm text-gray-400">
          {tab === "ended"
            ? `${info.closedLabel} ${info.noun} алга.`
            : tab === "review"
              ? `Зөвшөөрөл хүлээж буй ${info.noun} алга.`
              : `Одоогоор ${info.noun} алга.`}
        </p>
      )}

      {visible.map(renderCard)}

      {isAdmin && (
        <CampaignApproversModal isOpen={approversOpen} onClose={() => setApproversOpen(false)} />
      )}

      {isAdmin && (
        <CampaignModal
          isOpen={modalOpen}
          campaign={editing}
          onClose={() => setModalOpen(false)}
          onSaved={saved}
          board={board}
        />
      )}
    </div>
  );
}
