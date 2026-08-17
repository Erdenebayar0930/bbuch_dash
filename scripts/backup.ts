/**
 * Гараар backup авах — Google Drive руу, эсвэл локал файл руу.
 *
 * Ажиллуулах:
 *   npm run backup                       # Google Drive руу
 *   npm run backup -- --file dump.gz     # локал файл руу (Drive хэрэггүй)
 *
 * Локал горим нь Google-ийн тохиргоо шаардахгүй тул шилжилт хийх, өгөгдлөө
 * гартаа авахад тохиромжтой.
 *
 * Шаардлагатай env (.env.local): DATABASE_URL
 * Drive горим нь /backup хуудаснаас хийсэн холболтыг ашиглана
 * (тохиргоо нь `settings` хүснэгтэд хадгалагддаг).
 */
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDbPool, resolveDatabaseUrl } from "../src/lib/db/createPool";
import { dumpDatabase } from "../src/lib/backup/dump";

const args = process.argv.slice(2);
const fileFlag = args.indexOf("--file");
const filePath = fileFlag >= 0 ? args[fileFlag + 1] : undefined;

const connectionString = resolveDatabaseUrl();

if (!connectionString) {
  console.error("DATABASE_URL тохируулаагүй байна (.env.local).");
  process.exit(1);
}

const url = new URL(connectionString);
console.log("Бааз:", `${url.username}@${url.hostname}${url.pathname}`);

const pool = createDbPool(connectionString, 1);

async function main() {
  const startedAt = Date.now();

  if (filePath) {
    const summary = await dumpDatabase(pool, createWriteStream(filePath));
    report(summary.tables, summary.rows, summary.totalRows, startedAt, filePath);
    return;
  }

  /**
   * Drive руу байршуулах модулийг ЗӨВХӨН хэрэгтэй үед ачаална — `--file`
   * горимд Google-ийн тохиргоо огт шаардагдахгүй байх ёстой.
   */
  const { backupName, pruneBackups, uploadBackup } = await import(
    "../src/lib/backup/store"
  );
  const { getRetentionDays } = await import("../src/lib/backup/settings");

  const name = backupName();

  /**
   * Түр файлаар дамжуулна: Drive-д нэг PUT-аар урсгахын тулд яг хэмжээ
   * урьдчилан хэрэгтэй (`Content-Length`). Санах ойд барих нь том сан дээр
   * процессыг унагаана.
   */
  const workDir = await mkdtemp(join(tmpdir(), "bid-tuslay-backup-"));
  const localPath = join(workDir, name);

  try {
    const summary = await dumpDatabase(pool, createWriteStream(localPath));
    const uploaded = await uploadBackup(localPath, name);
    const pruned = await pruneBackups(await getRetentionDays());

    report(summary.tables, summary.rows, summary.totalRows, startedAt, name);
    console.log(`Drive: ${uploaded.link}`);

    if (pruned.length > 0) {
      console.log(`Хугацаа хэтэрсэн ${pruned.length} архив устгагдлаа.`);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function report(
  tables: string[],
  rows: Record<string, number>,
  total: number,
  startedAt: number,
  target: string
) {
  const nonEmpty = tables.filter((table) => rows[table] > 0);

  console.log();
  for (const table of nonEmpty) {
    console.log(`  ${table.padEnd(28)} ${rows[table]}`);
  }

  console.log();
  console.log(
    `✓ ${target} — ${tables.length} хүснэгт, ${total} мөр, ${(
      (Date.now() - startedAt) /
      1000
    ).toFixed(1)}s`
  );
}

main()
  .catch((error) => {
    console.error("Backup амжилтгүй боллоо:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
