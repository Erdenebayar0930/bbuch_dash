"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { listTransactions, type Transaction } from "@/lib/transactions";

/** Хэдэн миллисекунд тутамд дахин татах вэ (Postgres-д realtime суваг байхгүй) */
const POLL_INTERVAL = 30_000;

/**
 * Гүйлгээг Postgres-ээс татна.
 *
 * Firestore-ийн onSnapshot-ыг орлуулж, тогтмол давтамжтай дахин татах
 * (polling) аргыг ашиглана. Таб идэвхгүй үед татахгүй — дэмий хүсэлт хийхгүй.
 * Өөрчлөлт хийсний дараа `refresh()`-ийг дуудаж шууд шинэчилж болно.
 */
export function useTransactions() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await listTransactions();
      if (!mounted.current) return;
      setItems(next);
      setError(null);
    } catch (err) {
      console.error("Гүйлгээ уншихад алдаа гарлаа:", err);
      if (!mounted.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_INTERVAL);

    // Таб руу буцаж ирэхэд шууд шинэчилнэ
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { items, loading, error, refresh };
}
