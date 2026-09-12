import "server-only";

import { asc, sql } from "drizzle-orm";

import { defaultTithePatterns } from "@/data/titheOptions";
import { db } from "@/lib/db";
import { tithePatterns } from "@/lib/db/schema";

/**
 * 1/10 таних загваруудыг уншина.
 *
 * Хүснэгт хоосон бол анхны жагсаалтыг нэг удаа суулгана — эс бөгөөс шинэ
 * суулгац дээр бүх гүйлгээ «Өргөл» болж, хэрэглэгч юу болсныг ойлгохгүй.
 * Суулгасны дараа админ өөрөө нэмж, хасна.
 */
export async function readTithePatterns(): Promise<string[]> {
  const rows = await db
    .select()
    .from(tithePatterns)
    .orderBy(asc(tithePatterns.pattern));

  if (rows.length > 0) return rows.map((row) => row.pattern);

  // Анхдагч загваруудыг нэг удаа суулгана. MySQL-д onConflictDoNothing
  // байхгүй тул `pattern`-ыг өөр дээр нь оноох no-op update-ээр давхардлыг
  // залгина (pattern дээр unique индекстэй).
  await db
    .insert(tithePatterns)
    .values(
      defaultTithePatterns.map((pattern) => ({
        id: crypto.randomUUID(),
        pattern,
      }))
    )
    .onDuplicateKeyUpdate({ set: { pattern: sql`pattern` } });

  return [...defaultTithePatterns].sort();
}
