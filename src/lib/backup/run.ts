import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDbPool, resolveDatabaseUrl } from "@/lib/db/createPool";
import { dumpDatabase, type DumpSummary } from "./dump";
import { getRetentionDays } from "./settings";
import { backupName, pruneBackups, uploadBackup } from "./store";

export type BackupResult = DumpSummary & {
  name: string;
  /** Drive дээр нээх холбоос */
  link: string;
  size: number;
  durationMs: number;
  pruned: string[];
};

/**
 * Зэрэг ажиллаж буй backup.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ: cron давхар тохируулагдах, эсвэл өмнөх дуудалт удаашран
 * дараагийнх нь эхлэх боломжтой. Хоёр backup зэрэг ажиллавал сангаа хоёр
 * дахин уншиж, хоёр удаа байршуулна — яг хамгийн эмзэг агшинд серверийн
 * ачааллыг хоёр дахин нэмнэ. Хоёр дахь дуудалт хүлээхийн оронд ажиллаж
 * буйтайгаа НЭГДЭНЭ: cron давхардсан ч хор хийхгүй.
 */
let inFlight: Promise<BackupResult> | null = null;

export function runBackup(): Promise<BackupResult> {
  if (inFlight) return inFlight;

  inFlight = execute().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/**
 * Бүрэн backup — сангаас уншиж, түр файлд шахаад, Drive руу байршуулж,
 * хуучныг цэвэрлэнэ.
 *
 * ЯАГААД ТУСДАА POOL ВЭ: аппын нийтлэг pool нь хэрэглэгчийн хүсэлтүүдэд
 * зориулагдсан бөгөөд shared hosting дээр нийт холболт хомс. Backup нь нэг
 * холболтыг УДААН эзэлдэг (хүснэгт бүрийг гүйлгэж уншина) тул тэр pool-оос
 * авбал жирийн хүсэлтүүд холболт хүлээж эхэлнэ.
 *
 * ЯАГААД ТҮР ФАЙЛ ВЭ: Drive рүү нэг PUT-аар урсгахын тулд файлын яг хэмжээ
 * (`Content-Length`) урьдчилан хэрэгтэй. Санах ойд барих нь том сан дээр
 * процессыг унагаана — диск нь хамгийн хямд зуучлагч.
 */
async function execute(): Promise<BackupResult> {
  const connectionString = resolveDatabaseUrl();

  if (!connectionString) {
    throw new Error("DATABASE_URL тохируулаагүй байна.");
  }

  const startedAt = Date.now();
  const pool = createDbPool(connectionString, 1);
  const name = backupName();
  const workDir = await mkdtemp(join(tmpdir(), "bid-tuslay-backup-"));
  const localPath = join(workDir, name);

  try {
    const summary = await dumpDatabase(pool, createWriteStream(localPath));
    const uploaded = await uploadBackup(localPath, name);

    /**
     * Цэвэрлэгээг байршуулалт АМЖИЛТТАЙ болсны дараа л хийнэ. Эсрэг
     * дарааллаар хийвэл шинэ хуулбар үүсээгүй байхад хуучныг устгах эрсдэлтэй.
     *
     * Дутуу байршуулсан файлыг тусад нь цэвэрлэх шаардлагагүй: Drive-ийн
     * resumable сесс нь бүрэн PUT амжилттай болсон үед л файл үүсгэдэг —
     * тасалдвал юу ч үлдэхгүй.
     */
    const pruned = await pruneBackups(await getRetentionDays());

    return {
      ...summary,
      name,
      link: uploaded.link,
      size: uploaded.size,
      pruned,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    // Түр файлыг ЗААВАЛ устгана — алдаа гарсан ч дискэнд хог үлдээхгүй
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    await pool.end().catch(() => {});
  }
}
