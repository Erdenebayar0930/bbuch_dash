import "server-only";

import type { transactions } from "@/lib/db/schema";

const types = new Set(["income", "expense"]);
const statuses = new Set(["approved", "pending", "rejected"]);

/** numeric (string) -> number болгож client-д тохирсон хэлбэрт буулгана */
export const toTransaction = (row: typeof transactions.$inferSelect) => ({
  id: row.id,
  date: row.date,
  description: row.description,
  category: row.category,
  type: row.type as "income" | "expense",
  status: row.status as "approved" | "pending" | "rejected",
  amount: Math.abs(Number(row.amount)),
  account: row.account,
});

export type TransactionValues = {
  date: string;
  description: string;
  category: string;
  type: string;
  status: string;
  amount: string;
  account: string;
};

export type ParseResult =
  | { ok: false; error: string }
  | { ok: true; values: TransactionValues };

/**
 * Оролтыг шалгаад Postgres-д бичих хэлбэрт хөрвүүлнэ.
 *
 * `knownAccounts` нь бүртгэлтэй хандивын дансны дугаарууд — данс баазад
 * сууж байгаа тул дуудагч тал уншиж өгнө.
 */
export function parseTransactionInput(
  body: Record<string, unknown>,
  knownAccounts: Set<string>
): ParseResult {
  const date = String(body.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "date нь YYYY-MM-DD хэлбэртэй байна." };
  }

  const type = String(body.type ?? "");
  if (!types.has(type)) {
    return { ok: false, error: "type нь income эсвэл expense байна." };
  }

  const status = String(body.status ?? "approved");
  if (!statuses.has(status)) {
    return { ok: false, error: "status утга буруу байна." };
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount)) {
    return { ok: false, error: "amount нь тоо байх ёстой." };
  }

  // Хоосон = данстай холбоогүй гүйлгээ. Утга өгсөн бол бүртгэлтэй данс байх
  // ёстой: буруу дугаартай мөр нь аль ч дансны бүртгэлд харагдахгүй үлдэнэ.
  const account = String(body.account ?? "");
  if (account !== "" && !knownAccounts.has(account)) {
    return { ok: false, error: "account нь бүртгэлтэй дансны дугаар байна." };
  }

  return {
    ok: true,
    values: {
      date,
      description: String(body.description ?? ""),
      category: String(body.category ?? ""),
      type,
      status,
      amount: Math.abs(amount).toFixed(2),
      account,
    },
  };
}
