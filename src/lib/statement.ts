"use client";

import { apiFetch } from "./apiClient";

import type { DonationKind } from "@/data/titheOptions";

/** Хуулгаас уншсан, хараахан хадгалаагүй нэг мөр */
export type StatementPreviewRow = {
  /** Файл доторх мөрийн дугаар — алдаа заахад */
  rowNumber: number;
  date: string;
  /** Гүйлгээний утга */
  memo: string;
  amount: number;
  type: "income" | "expense";
  donorAccount: string;
  donorName: string;
  /** Нэр нь өмнөх бүртгэлээс ирсэн эсэх */
  fromRegistry: boolean;
  /** Орлого бол «1/10» эсвэл «Өргөл»; зарлага бол хоосон */
  kind: DonationKind | "";
  /** Энэ мөр аль хэдийн хадгалагдсан эсэх */
  duplicate: boolean;
  importKey: string;
};

export type StatementPreview = {
  rows: StatementPreviewRow[];
  /** Огноо, дүнгүй тул алгассан мөрийн тоо */
  skipped: number;
  patterns: string[];
};

/** Хуулгыг уншуулж, урьдчилан харах мөрүүдийг авна (юу ч хадгалахгүй). */
export async function previewStatement(
  account: string,
  file: File
): Promise<StatementPreview> {
  const form = new FormData();
  form.append("account", account);
  form.append("file", file);

  return apiFetch<StatementPreview>("/api/statement/preview", {
    method: "POST",
    body: form,
  });
}

export type CommitResult = {
  saved: number;
  /** Давхардсан тул алгассан мөр */
  skipped: number;
  /** Нэрийн бүртгэлд шинэчлэгдсэн данс */
  donors: number;
};

/** Баталгаажуулсан мөрүүдийг хадгална. */
export async function commitStatement(
  account: string,
  rows: StatementPreviewRow[]
): Promise<CommitResult> {
  return apiFetch<CommitResult>("/api/statement/commit", {
    method: "POST",
    body: {
      account,
      rows: rows.map((row) => ({
        importKey: row.importKey,
        date: row.date,
        memo: row.memo,
        amount: row.amount,
        type: row.type,
        donorAccount: row.donorAccount,
        donorName: row.donorName,
        kind: row.kind,
      })),
    },
  });
}

type PatternResponse = { patterns: string[] };

export async function listTithePatterns(): Promise<string[]> {
  const data = await apiFetch<PatternResponse>("/api/tithe-patterns");
  return data.patterns;
}

export async function addTithePattern(pattern: string): Promise<string[]> {
  const data = await apiFetch<PatternResponse>("/api/tithe-patterns", {
    method: "POST",
    body: { pattern },
  });
  return data.patterns;
}

export async function removeTithePattern(pattern: string): Promise<string[]> {
  const data = await apiFetch<PatternResponse>(
    `/api/tithe-patterns?pattern=${encodeURIComponent(pattern)}`,
    { method: "DELETE" }
  );
  return data.patterns;
}
