"use client";

import React, { useState } from "react";
import { Check, Copy, Landmark } from "lucide-react";

import {
  bankAppSchemes,
  bankLabel,
  formatAccountNumber,
  isBank,
  type DonationAccount,
} from "@/data/donationAccounts";
import { useDonationAccounts } from "@/hooks/useDonationAccounts";

/** "Хуулагдлаа" тэмдэглэгээ хэдэн миллисекунд харагдах вэ */
const COPIED_MS = 2000;

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // Clipboard API нь HTTPS биш орчинд ажиллахгүй — хуучин аргаар оролдоно
    try {
      const input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(input);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function DonationAccounts() {
  const { accounts, loading } = useDonationAccounts();
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const handleOpen = async (account: DonationAccount) => {
    // Дугаарыг эхлээд хуулна — банкны апп нээгдэхгүй байсан ч энэ нь ажиллана
    const ok = await copyToClipboard(account.number);

    setFailed(!ok);
    if (ok) {
      setCopied(account.number);
      window.setTimeout(() => setCopied(null), COPIED_MS);
    }

    // Дараа нь банкны аппыг нээхийг оролдоно. Апп суулгаагүй бол хуудас
    // байрандаа үлдэнэ — хэрэглэгчийн гарт хуулсан дугаар үлдсэн байна.
    if (!isBank(account.bank)) return;
    const scheme = bankAppSchemes[account.bank];

    try {
      window.location.assign(scheme);
    } catch {
      // Танихгүй scheme дээр зарим хөтөч алдаа шиднэ — хуулсан дугаар хэвээр
    }
  };

  return (
    <div className="surface p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Landmark
          className="h-5 w-5 text-accent-600 dark:text-accent-400"
          strokeWidth={1.8}
        />
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Тогтмол
          </h2>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Дарахад дансны дугаар хуулагдаж, банкны апп нээгдэнэ
          </p>
        </div>
      </div>

      {loading && accounts.length === 0 && (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Ачаалж байна...
        </p>
      )}

      {!loading && accounts.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-theme-sm text-gray-400 dark:border-white/10">
          Данс бүртгэгдээгүй байна.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {accounts.map((account) => {
          const isCopied = copied === account.number;

          return (
            <button
              key={account.number}
              type="button"
              onClick={() => handleOpen(account)}
              className="group flex items-start gap-3 rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-accent-300 hover:bg-accent-50/50 dark:border-white/10 dark:hover:border-accent-500/40 dark:hover:bg-accent-500/[0.07]"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-theme-sm font-semibold text-gray-900 dark:text-white">
                  {account.title}
                </span>

                <span className="mt-1.5 block font-mono text-theme-sm tracking-wide text-gray-700 dark:text-gray-300">
                  {formatAccountNumber(account.number)}
                </span>

                <span className="mt-1 block text-theme-xs text-gray-500 dark:text-gray-400">
                  {[bankLabel(account.bank), account.holder]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>

              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  isCopied
                    ? "bg-success-500/15 text-success-600 dark:text-success-400"
                    : "bg-gray-100 text-gray-500 group-hover:bg-white dark:bg-white/10 dark:text-gray-400"
                }`}
                aria-hidden="true"
              >
                {isCopied ? (
                  <Check className="h-4 w-4" strokeWidth={2.2} />
                ) : (
                  <Copy className="h-4 w-4" strokeWidth={1.8} />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Зөвхөн үйлдлийн хариу — тайван үед хоосон байна */}
      {(failed || copied) && (
        <p role="status" className="mt-3 text-theme-xs">
          {failed ? (
            <span className="text-error-500">
              Хуулж чадсангүй — дугаарыг гараар тэмдэглэнэ үү.
            </span>
          ) : (
            <span className="text-success-600 dark:text-success-400">
              Дансны дугаар хуулагдлаа.
            </span>
          )}
        </p>
      )}
    </div>
  );
}
