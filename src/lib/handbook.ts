"use client";

import { apiFetch } from "./apiClient";

export type HandbookDocument = {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  createdAt: Date;
};

type DocumentRow = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  filePath: string;
  fileName: string | null;
  fileSize: number | null;
  createdAt: string;
};

const toDocument = (row: DocumentRow): HandbookDocument => ({
  id: row.id,
  title: row.title,
  description: row.description ?? "",
  fileUrl: row.fileUrl,
  filePath: row.filePath,
  fileName: row.fileName ?? "",
  fileSize: row.fileSize ?? 0,
  createdAt: new Date(row.createdAt),
});

/** Гарын авлагын баримтууд — дараалалаар. */
export async function listHandbookDocuments(): Promise<HandbookDocument[]> {
  const data = await apiFetch<{ documents: DocumentRow[] }>("/api/handbook");
  return (data.documents ?? []).map(toDocument);
}

export type HandbookDocumentInput = {
  title: string;
  description: string;
  fileUrl: string;
  filePath: string;
  fileName: string;
  fileSize: number;
};

/** Шинэ баримтын бүртгэл нэмнэ (зөвхөн админ) — файлыг эхлээд Storage-д тавьсны дараа. */
export async function createHandbookDocument(
  input: HandbookDocumentInput
): Promise<HandbookDocument> {
  const data = await apiFetch<{ document: DocumentRow }>("/api/handbook", {
    method: "POST",
    body: input,
  });
  return toDocument(data.document);
}

/** Баримтыг DB-ээс устгаад, Storage-ийн замыг буцаана (зөвхөн админ). */
export async function deleteHandbookDocument(id: string): Promise<string> {
  const data = await apiFetch<{ ok: boolean; filePath: string }>(
    `/api/handbook/${id}`,
    { method: "DELETE" }
  );
  return data.filePath;
}
