"use client";

import { apiFetch } from "./apiClient";

export type TransactionType = "income" | "expense";
export type TransactionStatus = "approved" | "pending" | "rejected";

export type Transaction = {
  id: string;
  /** YYYY-MM-DD — эрэмбэлэх, шүүхэд ашиглагдана */
  date: string;
  description: string;
  category: string;
  type: TransactionType;
  status: TransactionStatus;
  /** Үргэлж эерэг тоо — тэмдгийг `type` тодорхойлно */
  amount: number;
};

export type TransactionInput = Omit<Transaction, "id">;

/** Бүх гүйлгээг татна (сервер талд 2000-аар хязгаарлагдсан). */
export async function listTransactions(): Promise<Transaction[]> {
  const data = await apiFetch<{ transactions: Transaction[] }>(
    "/api/transactions"
  );
  return data.transactions;
}

export async function createTransaction(input: TransactionInput) {
  return apiFetch<{ transactions: Transaction[] }>("/api/transactions", {
    method: "POST",
    body: { ...input, amount: Math.abs(input.amount) },
  });
}

export async function updateTransaction(id: string, input: TransactionInput) {
  return apiFetch<{ transaction: Transaction }>(`/api/transactions/${id}`, {
    method: "PUT",
    body: { ...input, amount: Math.abs(input.amount) },
  });
}

export async function deleteTransaction(id: string) {
  return apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
}

/** Гүйлгээний нийт тоо. */
export async function countTransactions(): Promise<number> {
  const data = await apiFetch<{ total: number }>("/api/transactions");
  return data.total;
}

/**
 * Жишиг өгөгдлийг нэг багцаар бичнэ. Хүснэгт хоосон үед л ажиллана —
 * давхардал үүсгэхээс сэргийлнэ.
 */
export async function seedTransactions(rows: TransactionInput[]) {
  const existing = await countTransactions();
  if (existing > 0) return 0;

  const result = await apiFetch<{ count: number }>("/api/transactions", {
    method: "POST",
    body: rows.map((row) => ({ ...row, amount: Math.abs(row.amount) })),
  });

  return result.count;
}
