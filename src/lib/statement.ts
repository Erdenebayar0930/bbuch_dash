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
  /** Орлого бол «1/10» эсвэл «Өргөл»; зарлага бол хоосон */
  kind: DonationKind | "";
  /** Мөрийг дахин ангилахад ашиглах тогтвортой түлхүүр */
  importKey: string;
};

export type StatementPreview = {
  rows: StatementPreviewRow[];
  /** Огноо, дүнгүй тул алгассан мөрийн тоо */
  skipped: number;
  /** Сервер ямар загвараар 1/10-ыг таньсан бэ */
  patterns: string[];
};

/** Хуулгыг уншуулж, ангилсан мөрүүдийг авна (юу ч хадгалахгүй). */
export async function previewStatement(file: File): Promise<StatementPreview> {
  const form = new FormData();
  form.append("file", file);

  return apiFetch<StatementPreview>("/api/statement/preview", {
    method: "POST",
    body: form,
  });
}

type PatternResponse = { patterns: string[] };

/**
 * Загварын CRUD. Гурвуулаа ШИНЭЧЛЭГДСЭН бүтэн жагсаалтыг буцаана — дуудагч
 * тал өөрөө нэмэх/хасахаа тааварлах шаардлагагүй, сервер дэх төлөв нь эх
 * сурвалж хэвээр үлдэнэ.
 */
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
