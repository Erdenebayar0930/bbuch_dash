"use client";

import React, { useEffect, useState } from "react";
import { Pencil, UserCheck } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import BankLogo from "@/components/finance/BankLogo";
import GivingTracker from "@/components/finance/GivingTracker";
import { CopyLine, systemName } from "@/components/finance/TitheAccountCard";
import { DISCIPLINE_ACCOUNT, bankLabel, formatAccountNumber } from "@/data/donationAccounts";
import { copyToClipboard } from "@/lib/clipboard";
import { loadDiscipline, saveDiscipline, type DisciplineInfo } from "@/lib/giving";
import { isAdminRole } from "@/lib/permissions";
import { listUsers, type AppUser } from "@/lib/users";

const COPIED_MS = 2000;
const DEFAULT_AMOUNT = 450000;

const formatMoney = (value: number) => `${value.toLocaleString("en-US").replace(/,/g, " ")}₮`;

/**
 * Хангамж → Сахилгажуулалт. Хангамжийн аймгийнхан сар бүр тогтмол дүн
 * төлнө: дээр нь дүн (админ засна), данс ба гүйлгээний утга хуулах; доор нь
 * гишүүд × сарууд төлсөн/төлөөгүй (`GivingTracker`, board `discipline`).
 */
export default function DisciplinePanel() {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);
  const [info, setInfo] = useState<DisciplineInfo | null>(null);
  const amount = info?.amount ?? null;
  /** Чагтлагч сонгох жагсаалт — Хангамжийн аймгийнхан ба админууд */
  const [candidates, setCandidates] = useState<AppUser[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    loadDiscipline()
      .then(setInfo)
      .catch((err) => {
        console.error("Сахилгажуулалтын тохиргоо уншиж чадсангүй:", err);
        setInfo({ amount: DEFAULT_AMOUNT, checker: null, canCheck: false, canView: false });
      });
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    listUsers()
      .then((rows) =>
        setCandidates(
          rows
            .filter(
              (row) =>
                row.status === "active" &&
                (isAdminRole(row.role) || row.aimags.includes("supply"))
            )
            .sort((a, b) =>
              `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, "mn")
            )
        )
      )
      .catch((err) => console.error("Хэрэглэгчдийг уншиж чадсангүй:", err));
  }, [isAdmin]);

  const pickChecker = async (uid: string) => {
    setError(null);
    try {
      await saveDiscipline({ checkerUid: uid });
      setInfo(await loadDiscipline());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    }
  };

  const copy = async (value: string) => {
    if (!(await copyToClipboard(value))) return;
    setCopied(value);
    window.setTimeout(() => setCopied((current) => (current === value ? null : current)), COPIED_MS);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(draft.replace(/[\s,₮]/g, ""));
    if (!Number.isInteger(value) || value < 0) {
      setError("Дүнг бүхэл тоогоор оруулна уу.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveDiscipline({ amount: value });
      setInfo((prev) => (prev ? { ...prev, amount: value } : prev));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  const name = systemName(user?.first_name, user?.last_name);
  // Улаанбаатарын одоогийн он сар — «2026.11»
  const period = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .replace("-", ".");
  const memo = `Оффис түрээс-${name}-${period}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="surface mx-auto w-full max-w-2xl overflow-hidden">
        {/* Сар бүрийн дүн */}
        <div className="flex flex-wrap items-center gap-3 bg-accent-600 px-5 py-4 text-white">
          <div className="min-w-0 flex-1">
            <p className="text-theme-xs font-medium uppercase tracking-wide text-white/80">
              Сар бүр тогтмол төлөх дүн
            </p>
            {editing ? (
              <form onSubmit={save} className="mt-1 flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  inputMode="numeric"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  aria-label="Сар бүрийн дүн"
                  className="h-10 w-40 rounded-lg border border-white/30 bg-white/10 px-3 text-lg font-bold text-white placeholder:text-white/60 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 rounded-lg bg-white px-3.5 text-theme-sm font-semibold text-accent-700 disabled:opacity-60"
                >
                  Хадгалах
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                  className="h-10 rounded-lg px-3 text-theme-sm font-medium text-white/90 hover:bg-white/10"
                >
                  Болих
                </button>
              </form>
            ) : (
              <p className="text-2xl font-bold">{amount === null ? "…" : formatMoney(amount)}</p>
            )}
          </div>
          {isAdmin && !editing && amount !== null && (
            <button
              type="button"
              onClick={() => {
                setDraft(String(amount));
                setEditing(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/15 px-3 text-theme-xs font-medium hover:bg-white/25"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
              Дүн өөрчлөх
            </button>
          )}
        </div>
        {error && (
          <p className="bg-error-50 px-5 py-2 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}

        {/* Банк ба хүлээн авагч */}
        <div className="flex items-center gap-4 px-5 pt-5">
          <BankLogo bank={DISCIPLINE_ACCOUNT.bank} />
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {bankLabel(DISCIPLINE_ACCOUNT.bank)}
            </p>
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              {DISCIPLINE_ACCOUNT.holder}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <CopyLine
            hint="Дансны дугаар"
            display={formatAccountNumber(DISCIPLINE_ACCOUNT.number)}
            value={DISCIPLINE_ACCOUNT.number}
            mono
            copied={copied === DISCIPLINE_ACCOUNT.number}
            onCopy={copy}
          />
          {name ? (
            <CopyLine hint="Гүйлгээний утга" display={memo} copied={copied === memo} onCopy={copy} />
          ) : (
            <p className="rounded-lg bg-warning-50 px-4 py-3 text-theme-sm text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
              Профайлд нэрээ бөглөсний дараа гүйлгээний утга энд гарна.
            </p>
          )}
        </div>
      </div>

      {/* Он сар × төлсөн/төлөөгүй — админ ба чагтлагчид */}
      {info?.canView && (
        <div>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
                Төлөлтийн байдал
              </h2>
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                Хангамжийн аймгийн гишүүд жагсаалтад автоматаар орно.{" "}
                {info.checker
                  ? `Зөвхөн ${info.checker.name} чагтална.`
                  : "Чагтлагч сонгоогүй тул админ чагтална."}
              </p>
            </div>

            {isAdmin && (
              <label className="flex items-center gap-2 text-theme-sm text-gray-600 dark:text-gray-300">
                <UserCheck className="h-4 w-4 text-gray-400" strokeWidth={1.8} />
                Чагтлагч
                <select
                  value={info.checker?.uid ?? ""}
                  onChange={(event) => pickChecker(event.target.value)}
                  className="h-10 min-w-[200px] rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-800 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
                >
                  <option value="">Сонгоогүй (админ)</option>
                  {info.checker && !candidates.some((row) => row.uid === info.checker?.uid) && (
                    <option value={info.checker.uid}>{info.checker.name}</option>
                  )}
                  {candidates.map((row) => (
                    <option key={row.uid} value={row.uid}>
                      {[row.last_name, row.first_name].filter(Boolean).join(" ") || row.email}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <GivingTracker board="discipline" readOnly={!info.canCheck} canManage={isAdmin} />
        </div>
      )}
    </div>
  );
}
