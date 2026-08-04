"use client";

import { getCurrentUser } from "./users";

/**
 * Нэвтэрсэн хэрэглэгчийн эрхийг буцаана.
 * Профайл Postgres-д байх тул /api/users/me route-оор уншина.
 */
export async function getUserRole(): Promise<string | null> {
  const user = await getCurrentUser().catch(() => null);
  return user?.role ?? null;
}
