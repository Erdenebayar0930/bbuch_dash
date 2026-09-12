"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  listDonationAccounts,
  type DonationAccount,
} from "@/lib/donationAccounts";

/**
 * Хандивын данснуудыг татна.
 *
 * Данс ховор өөрчлөгддөг ч Санхүүгийн бараг бүх хэсэгт хэрэгтэй тул үр дүнг
 * модулийн хэмжээнд кэшлэнэ — хуудас бүр өөрөө татвал нэг ачаалалт дээр
 * хэдэн ижил хүсэлт явна. Нэмэх/засахын дараа `refresh()`-ийг дуудна.
 */
let cache: DonationAccount[] | null = null;
let inflight: Promise<DonationAccount[]> | null = null;

/** Кэшийг хүчингүй болгоно — данс өөрчлөгдсөний дараа */
export function invalidateDonationAccounts() {
  cache = null;
  inflight = null;
}

function load(force: boolean): Promise<DonationAccount[]> {
  if (force) invalidateDonationAccounts();
  if (cache) return Promise.resolve(cache);

  // Зэрэг дуудагдвал нэг л хүсэлт явуулна
  inflight ??= listDonationAccounts()
    .then((accounts) => {
      cache = accounts;
      return accounts;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function useDonationAccounts() {
  const [accounts, setAccounts] = useState<DonationAccount[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async (force = true) => {
    try {
      const next = await load(force);
      if (!mounted.current) return;
      setAccounts(next);
      setError(null);
    } catch (err) {
      console.error("Данс уншихад алдаа гарлаа:", err);
      if (!mounted.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh(false);

    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  return { accounts, loading, error, refresh };
}
