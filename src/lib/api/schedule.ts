import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";

/** `settings` хүснэгтэд хадгалах түлхүүр — постер зургийн URL */
const SETTING_KEY = "weekly_schedule_poster_url";

export async function readSchedulePosterUrl(): Promise<string> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, SETTING_KEY))
    .limit(1);

  return row?.value ?? "";
}

export async function writeSchedulePosterUrl(url: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key: SETTING_KEY, value: url })
    .onDuplicateKeyUpdate({ set: { value: url, updatedAt: new Date() } });
}
