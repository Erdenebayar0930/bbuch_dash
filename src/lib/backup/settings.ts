import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";

/**
 * Ажиллах үеийн тохиргоог баазаас уншиж/бичнэ.
 *
 * Google Drive-ийн холболтыг дэлгэцээс хийдэг болгосон тул утгууд нь орчны
 * хувьсагчид байх боломжгүй: refresh token нь OAuth урсгалын ДУНД үүсдэг ба
 * тэр агшинд hPanel руу гараар бичих боломжгүй.
 *
 * `server-only`-г ЗОРИУДААР импортлохгүй — `npm run backup` зэрэг CLI
 * скриптүүд Drive-ийн тохиргоог эндээс уншина.
 */

export const DRIVE_KEYS = {
  clientId: "drive_client_id",
  clientSecret: "drive_client_secret",
  refreshToken: "drive_refresh_token",
  folderId: "drive_folder_id",
  folderName: "drive_folder_name",
  account: "drive_account",
  state: "drive_oauth_state",
} as const;

/**
 * Cron-оос нөөцлөлт дуудахад ашиглах токен.
 *
 * Орчны хувьсагчид биш баазад байгаа нь санаатай: hPanel руу орж хувьсагч
 * нэмээд дахин деплой хийх алхмыг арилгана. Хуучин `BACKUP_TOKEN` env-ийг ч
 * дэмжсэн хэвээр (нөөц зам).
 */
export const BACKUP_TOKEN_KEY = "backup_token";

/** Архивыг хэдэн хоног хадгалахыг заасан тохиргоо */
export const BACKUP_RETENTION_KEY = "backup_retention_days";

/** Тохируулаагүй үеийн хадгалах хугацаа */
export const DEFAULT_RETENTION_DAYS = 15;

/** Зөвшөөрөгдөх хязгаар — 0 бол бүх архив устана, хэт их бол Drive дүүрнэ */
export const MIN_RETENTION_DAYS = 3;
export const MAX_RETENTION_DAYS = 365;

/**
 * Хадгалах хугацаа — бааз → env → анхдагч гэсэн дарааллаар.
 *
 * Апп ба CLI скрипт хоёул ЭНЭ функцийг дуудна: хоёр газар тус тусад нь
 * тооцвол дэлгэцээс өөрчилсөн утга cron-оор ажиллах нөөцлөлтөд хүрэхгүй үлдэнэ.
 */
export async function getRetentionDays(): Promise<number> {
  const stored = await getSetting(BACKUP_RETENTION_KEY);
  const value = Number(stored ?? process.env.BACKUP_RETENTION_DAYS);

  if (!Number.isFinite(value) || value <= 0) return DEFAULT_RETENTION_DAYS;

  return Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, value));
}

/**
 * ⚠ ЭНД КЭШ БАЙХГҮЙ нь САНААТАЙ.
 *
 * Эхэндээ 30 секундын кэштэй байсныг авав. Passenger нь аппын ХЭД ХЭДЭН
 * процесс ажиллуулдаг бөгөөд OAuth-ийн `state` нь нэг процесс дээр бичигдээд
 * НӨГӨӨ дээр уншигдаж болно. Кэштэй бол уншигч процесс "state алга" гэж
 * буруу шийдэж, холболт санамсаргүй бүтэлгүйтэнэ.
 *
 * Хүснэгт нь ердөө хэдэн мөртэй, түлхүүрээр индекслэгдсэн тул кэшээс хэмнэх
 * зүйл нь алдааны эрсдэлээ нөхөхгүй.
 */
export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);

  return row?.value ?? null;
}

export async function setSettings(
  entries: Record<string, string>
): Promise<void> {
  for (const [key, value] of Object.entries(entries)) {
    await db
      .insert(settings)
      .values({ key, value })
      .onDuplicateKeyUpdate({ set: { value, updatedAt: new Date() } });
  }

}

export async function removeSettings(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  await db.delete(settings).where(inArray(settings.key, keys));
}

export async function removeSetting(key: string): Promise<void> {
  await db.delete(settings).where(eq(settings.key, key));
}
