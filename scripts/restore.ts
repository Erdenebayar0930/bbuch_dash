/**
 * Backup архиваас өгөгдлийг СЭРГЭЭНЭ.
 *
 * Ажиллуулах:
 *   npm run restore -- --file dump.gz              # юу болохыг ХАРУУЛНА
 *   npm run restore -- --file dump.gz --write      # бодитоор бичнэ
 *   npm run restore -- --list                      # Storage дахь архивууд
 *   npm run restore -- --remote <drive-file-id> --write
 *
 * ⚠ АНХААР: `--write` нь сэргээж буй хүснэгт бүрийг УРЬДЧИЛАН ХООСЛОНО
 * (DELETE). Өөрөөр хэлбэл архив дахь өгөгдөл нь эцсийн үнэн болно. Тиймээс
 * анхдагчаар зөвхөн харуулдаг горимтой: юу устаж, юу орохыг эхлээд уншина.
 *
 * ЯАГААД ХООСЛОДОГ ВЭ: хэсэгчилсэн сэргээлт нь хамгийн муу төлөв рүү хүргэдэг
 * — хуучин, шинэ мөр холилдож, аль нь зөв болох нь мэдэгдэхгүй болно.
 *
 * Шаардлагатай env (.env.local): DATABASE_URL
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";

import { createDbPool, resolveDatabaseUrl } from "../src/lib/db/createPool";
import { decodeValue } from "../src/lib/backup/dump";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const filePath = flag("--file");
const remoteName = flag("--remote");
const write = args.includes("--write");
const list = args.includes("--list");

/** Нэг INSERT-д багтаах мөрийн тоо — том пакет нь max_allowed_packet-д хүрнэ */
const CHUNK = 200;

/**
 * Архивт ОРДОГГҮЙ тохиргоонууд ([dump.ts](../src/lib/backup/dump.ts)-тэй
 * ижил жагсаалт). Сэргээхэд эдгээрийг хөндөхгүй — эс бөгөөс Drive-ийн
 * холболт тасарна.
 */
const SECRET_SETTING_KEYS = [
  "drive_client_secret",
  "drive_refresh_token",
  "drive_oauth_state",
  "backup_token",
];

async function source(): Promise<NodeJS.ReadableStream> {
  if (filePath) return createReadStream(filePath);

  if (remoteName) {
    const { downloadBackup } = await import("../src/lib/backup/store");
    return Readable.from(await downloadBackup(remoteName));
  }

  throw new Error("--file эсвэл --remote заана уу.");
}

async function main() {
  if (list) {
    const { listBackups } = await import("../src/lib/backup/store");
    const backups = await listBackups();

    if (backups.length === 0) {
      console.log("Архив олдсонгүй.");
      return;
    }

    for (const backup of backups) {
      console.log(
        `${backup.id}  ${backup.name}  ` +
          `${(backup.size / 1024 / 1024).toFixed(2)} MB  ${backup.createdAt}`
      );
    }
    console.log();
    console.log("Сэргээхдээ эхний баганын ID-г --remote-д өгнө үү.");
    return;
  }

  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    console.error("DATABASE_URL тохируулаагүй байна (.env.local).");
    process.exit(1);
  }

  const url = new URL(connectionString);
  console.log("Бааз  :", `${url.username}@${url.hostname}${url.pathname}`);
  console.log("Горим :", write ? "БИЧНЭ" : "зөвхөн харуулна (--write нэмнэ үү)");
  console.log();

  const pool = createDbPool(connectionString, 1);

  /**
   * БҮХ үйлдлийг НЭГ холболтоор хийнэ.
   *
   * `FOREIGN_KEY_CHECKS` болон гүйлгээ хоёул СЕССИЙН шинжтэй: pool-оос өөр
   * өөр холболт авбал тохиргоо нэг холболт дээр тавигдаад, бичилт нь өөр
   * холболтоор явж, хамгаалалт огт ажиллахгүй.
   */
  const connection = await pool.getConnection();

  /**
   * Гүйлгээ эхэлсэн эсэх — `catch` блокоос ч харагдах ёстой тул `try`-аас
   * ГАДНА зарлав.
   */
  let started = false;

  try {
    /** Хүснэгт бүрийн хуримтлагдсан мөрүүд — CHUNK хүрмэгц бичнэ */
    const buffer = new Map<string, Record<string, unknown>[]>();
    const counts: Record<string, number> = {};
    let header: { v?: number; createdAt?: string; tables?: string[] } | null = null;
    let complete = false;
    const skipped: string[] = [];

    /** Баазад БОДИТООР байгаа хүснэгтүүд — архивт байгаа ч энд байхгүй байж болно */
    const [existingRows] = await connection.query(
      "SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'"
    );
    const existing = new Set(
      (existingRows as Record<string, string>[]).map((row) => Object.values(row)[0])
    );

    /**
     * Хүснэгт бүрийн БОДИТ баганууд.
     *
     * Хоёр шалтгаанаар хэрэгтэй:
     *
     * 1. АЮУЛГҮЙ БАЙДАЛ. Баганы нэрийг SQL-д параметрээр дамжуулах боломжгүй
     *    (зөвхөн утгыг), тиймээс мөрөнд шууд наах ёстой болдог. Архивын
     *    агуулгад найдвал тусгайлан бэлдсэн файл дахь баганы нэр SQL руу
     *    нэвтэрч чадна. Баазаас уншсан жагсаалттай тулгаснаар архивт юу ч
     *    бичигдсэн бай, зөвхөн ҮНЭХЭЭР байгаа багана л асуулгад орно.
     *
     * 2. ХУУЧИН АРХИВ. Схем өөрчлөгдөж багана хасагдсаны дараа хуучин
     *    архиваас сэргээхэд "Unknown column" гэж унахын оронд тэр баганыг
     *    алгасаад үлдсэнийг нь сэргээнэ.
     */
    const columnsOf = new Map<string, Set<string>>();
    for (const table of existing) {
      const [cols] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
      columnsOf.set(
        table,
        new Set((cols as { Field: string }[]).map((col) => col.Field))
      );
    }

    /** Архивт байсан ч баазад алга болсон баганууд — нэг удаа мэдэгдэнэ */
    const droppedColumns = new Set<string>();

    /**
     * ⚠ `createInterface`-ийг БҮХ бэлтгэл дууссаны ДАРАА үүсгэнэ.
     *
     * readline нь үүсмэгц урсгалыг "flowing" горимд оруулж мөрүүдийг цацаж
     * эхэлдэг. Хэрэв энэ хооронд `await` хийвэл (жишээ нь дээрх SHOW TABLES)
     * тэр мөрүүд сонсогчгүй алга болж, доорх `for await` нь хэзээ ч ирэхгүй
     * мөр хүлээсээр ГАЦНА. Энэ нь ЯГ ингэж илэрсэн алдаа.
     */
    const reader = createInterface({
      input: (await source()).pipe(createGunzip()),
      crlfDelay: Infinity,
    });

    /**
     * Бичих бэлтгэл — архивын ТОЛГОЙ мөрийг уншмагц нэг удаа.
     *
     * Хоёр зүйлийг ЭНД, бичилт эхлэхээс ӨМНӨ хийх нь чухал:
     *
     * 1. `FOREIGN_KEY_CHECKS = 0` — архив дахь хүснэгтүүд цагаан толгойн
     *    дарааллаар ирдэг (children нь users-ээс өмнө). Шалгалттай бол
     *    хүүхдийн мөр эцгээсээ өмнө ороход FK алдаа өгнө. Дарааллыг бүрэн
     *    зөв тооцоолох нь хамаарлын графыг шаардах бөгөөд мөчлөгтэй үед
     *    боломжгүй — тиймээс шалгалтыг түр унтраана. Архив нь өөрөө
     *    бүрэн бүтэн байсан тул холбоос нь зөв хэвээр.
     *
     * 2. БҮХ хүснэгтийг УРЬДЧИЛАН хоослоно. Урьд нь хүснэгт бүрийг эхний
     *    мөр ирэхэд нь цэвэрлэдэг байсан бөгөөд `users`-ийг цэвэрлэх үед
     *    `ON DELETE CASCADE` нь аль хэдийн сэргээгдсэн `children`,
     *    `notifications`-ыг ДАГУУЛЖ УСТГАДАГ байв — сэргээлт "амжилттай"
     *    гэж дуусаад өгөгдөл дутуу үлдэнэ.
     */
    const begin = async (tables: string[]) => {
      if (!write || started) return;
      started = true;

      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
      await connection.beginTransaction();

      for (const table of tables) {
        if (!existing.has(table)) {
          skipped.push(table);
          continue;
        }

        /**
         * `settings` доторх НУУЦ мөрүүдийг УСТГАХГҮЙ.
         *
         * Тэдгээр (Google Drive-ийн refresh token, cron токен) нь архивт
         * ЗОРИУДААР ордоггүй. Бүхэлд нь хоословол сэргээх бүрд Drive-ийн
         * холболт тасарч, нөөцлөлт зогсох байсан — өөрөөр хэлбэл сэргээлт
         * өөрөө дараагийн нөөцлөлтийг унтраана. Тиймээс архивт байхгүй
         * зүйлийг устгахгүй үлдээнэ.
         */
        if (table === "settings") {
          await connection.query(
            `delete from \`settings\` where setting_key not in (${SECRET_SETTING_KEYS.map(
              () => "?"
            ).join(",")})`,
            SECRET_SETTING_KEYS
          );
          continue;
        }

        await connection.query(`delete from \`${table}\``);
      }
    };

    const flush = async (table: string) => {
      const rows = buffer.get(table);
      if (!rows || rows.length === 0) return;

      if (write && existing.has(table)) {
        const known = columnsOf.get(table) ?? new Set<string>();
        const columns = Object.keys(rows[0]).filter((column) => {
          if (known.has(column)) return true;
          droppedColumns.add(`${table}.${column}`);
          return false;
        });

        if (columns.length === 0) {
          buffer.set(table, []);
          return;
        }

        const placeholders = `(${columns.map(() => "?").join(",")})`;
        const values = rows.flatMap((row) =>
          columns.map((column) => decodeValue(row[column]))
        );

        await connection.query(
          `insert into \`${table}\` (${columns
            .map((column) => `\`${column}\``)
            .join(",")}) values ${rows.map(() => placeholders).join(",")}`,
          values
        );
      }

      buffer.set(table, []);
    };

    for await (const line of reader) {
      if (!line.trim()) continue;

      const entry = JSON.parse(line) as {
        v?: number;
        tables?: string[];
        t?: string;
        r?: Record<string, unknown>;
        done?: boolean;
      };

      if (entry.v !== undefined) {
        header = entry;
        await begin(entry.tables ?? []);
        continue;
      }

      if (entry.done) {
        complete = true;
        continue;
      }

      if (!entry.t || !entry.r) continue;

      counts[entry.t] = (counts[entry.t] ?? 0) + 1;

      const rows = buffer.get(entry.t) ?? [];
      rows.push(entry.r);
      buffer.set(entry.t, rows);

      if (rows.length >= CHUNK) await flush(entry.t);
    }

    /**
     * ТӨГСГӨЛИЙН МӨРГҮЙ архив = дутуу бичигдсэн. Ийм файлаас сэргээвэл
     * "амжилттай" мэт харагдаад өгөгдлийн сүүлийн хэсэг чимээгүй алга болно.
     */
    if (!complete) {
      throw new Error(
        "Архив дутуу байна (төгсгөлийн мөр алга). Сэргээхэд ашиглаж болохгүй."
      );
    }

    for (const table of buffer.keys()) await flush(table);

    if (started) await connection.commit();

    console.log("Архив :", header?.createdAt ?? "?");
    console.log();
    for (const [table, count] of Object.entries(counts).sort()) {
      console.log(`  ${table.padEnd(28)} ${count}`);
    }

    if (droppedColumns.size > 0) {
      console.log();
      console.log(
        `⚠ Баазад байхгүй тул алгассан багана: ${[...droppedColumns].join(", ")}`
      );
    }

    if (skipped.length > 0) {
      console.log();
      console.log(
        `⚠ Баазад байхгүй тул алгассан хүснэгт: ${skipped.join(", ")}`
      );
      console.log("  Схем хуучирсан байж магадгүй — `npm run db:push` шалгана уу.");
    }

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    console.log();
    console.log(
      write
        ? `✓ ${Object.keys(counts).length} хүснэгт, ${total} мөр сэргээлээ`
        : `${Object.keys(counts).length} хүснэгт, ${total} мөр сэргээгдэх байсан. Бичихийн тулд --write нэмнэ үү.`
    );
  } catch (error) {
    /**
     * Гүйлгээг буцаана. Үүнгүйгээр хамгийн муу төлөв үлдэнэ: хүснэгтүүд нь
     * хоосруулагдсан хэрнээ шинэ өгөгдөл нь дутуу — өөрөөр хэлбэл сэргээх
     * гэж оролдоод байсан өгөгдлөө устгачихна.
     */
    if (started) await connection.rollback().catch(() => {});
    throw error;
  } finally {
    // Шалгалтыг ЗААВАЛ буцааж асаана — холболт pool руу буцаж, дараагийн
    // хэрэглэгчид шалгалтгүй очих ёсгүй.
    await connection.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
    connection.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Сэргээх үед алдаа гарлаа:", error);
  process.exitCode = 1;
});
