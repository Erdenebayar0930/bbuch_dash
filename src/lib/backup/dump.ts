import { createGzip } from "node:zlib";
import { Readable, pipeline } from "node:stream";
import { promisify } from "node:util";

import type { Connection as CallbackConnection } from "mysql2";
import type { Pool } from "mysql2/promise";
import type { Writable } from "node:stream";

const streamPipeline = promisify(pipeline);

/**
 * Өгөгдлийн сангийн бүрэн хуулбарыг NDJSON + gzip болгож гаргана.
 *
 * ЯАГААД mysqldump БИШ ВЭ: shared hosting дээр аппын хэрэглэгчид shell
 * хандалт, `mysqldump` binary байхгүй. Тиймээс хуулбарыг драйвераар өөрөө
 * унших ёстой.
 *
 * ЯАГААД УРСГАЛААР (stream) ВЭ: Passenger процесс нь санах ойн хатуу
 * хязгаартай. Бүх мөрийг массивт цуглуулбал том хүснэгт дээр процесс OOM-оор
 * унаж, УГ НЬ АЖИЛЛАЖ БАЙСАН аппыг хамт унагана. Мөр бүрийг уншмагц шууд
 * бичих нь санах ойн хэрэглээг мөрийн хэмжээгээр хязгаарлана.
 *
 * Формат — мөр тутамд нэг JSON:
 *   {"v":1,"createdAt":"...","tables":[...]}        ← толгой мөр
 *   {"t":"users","r":{...}}                          ← өгөгдлийн мөр
 *   {"done":true,"rows":{"users":12,...}}            ← төгсгөлийн мөр
 *
 * Толгой ба төгсгөлийн мөр байгаа нь ТАСАРСАН файлыг таних боломж өгнө:
 * төгсгөлийн мөргүй архив бол дутуу — сэргээхэд ашиглаж болохгүй.
 */

export type DumpSummary = {
  tables: string[];
  rows: Record<string, number>;
  totalRows: number;
};

/** Драйвераас ирсэн утгыг JSON-д аюулгүй хэлбэрт буулгана. */
function encodeValue(value: unknown): unknown {
  if (value instanceof Date) {
    // MySQL-ийн `YYYY-MM-DD HH:mm:ss` — pool нь UTC сессээр ажилладаг тул
    // ISO мөрийн оронд энэ хэлбэрийг хэрэглэвэл сэргээхэд хөрвүүлэлт хэрэггүй.
    return value.toISOString().slice(0, 19).replace("T", " ");
  }

  if (Buffer.isBuffer(value)) {
    return { __buffer: value.toString("base64") };
  }

  /**
   * JSON багана.
   *
   * MySQL 8 дээр драйвер нь JSON-ыг ЗАДАЛЖ объект/массив болгож өгдөг
   * (MariaDB дээр мөрөөр). Задарсан утгыг задарсан хэвээр нь буцааж бичвэл
   * mysql2 нь массивыг SQL-ийн жагсаалт, объектыг `[object Object]` болгож
   * escape хийдэг тул INSERT нь синтакс алдаа өгнө. Тиймээс мөр болгож
   * тэмдэглэж хадгална — сэргээхэд MySQL өөрөө JSON гэж хүлээж авна.
   */
  if (value !== null && typeof value === "object") {
    return { __json: JSON.stringify(value) };
  }

  return value;
}

/** `encodeValue`-ийн эсрэг үйлдэл — сэргээх үед хэрэглэнэ. */
export function decodeValue(value: unknown): unknown {
  if (value && typeof value === "object") {
    const wrapper = value as Record<string, unknown>;

    if ("__buffer" in wrapper) {
      return Buffer.from(String(wrapper.__buffer), "base64");
    }

    // JSON баганад мөр дамжуулна — MySQL өөрөө задална
    if ("__json" in wrapper) {
      return String(wrapper.__json);
    }
  }

  return value;
}

/**
 * Нөөцлөлтөд ОРУУЛАХГҮЙ тохиргоонууд.
 *
 * Эдгээр нь бизнесийн өгөгдөл биш, ХОЛБОЛТЫН НУУЦ. Архивт оруулбал файл гарт
 * орсон хүн Google Drive руу ч хандах болно — өөрөөр хэлбэл нөөцлөлт өөрөө
 * нөөцлөлтөө задруулах суваг болно. Сэргээсний дараа холболтыг дэлгэцээс
 * дахин хийхэд хангалттай тул алдах зүйл алга.
 */
const SECRET_SETTING_KEYS = new Set([
  "drive_client_secret",
  "drive_refresh_token",
  "drive_oauth_state",
  "backup_token",
]);

/** Санд БОДИТООР байгаа хүснэгтүүд — схемийн жагсаалтад найдахгүй */
export async function listTables(pool: Pool): Promise<string[]> {
  const [rows] = await pool.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");

  return (rows as Record<string, string>[])
    .map((row) => Object.values(row)[0])
    .sort();
}

/**
 * Хуулбарыг `target` руу gzip-лэж бичнэ.
 *
 * `target` нь файл, HTTP хариу, эсвэл дурын бичих урсгал байж болно —
 * энэ функц хаана хадгалахыг мэдэхгүй.
 */
export async function dumpDatabase(
  pool: Pool,
  target: Writable
): Promise<DumpSummary> {
  const tables = await listTables(pool);
  const rows: Record<string, number> = {};

  const source = Readable.from(generate(), { objectMode: false });
  const gzip = createGzip({ level: 6 });

  await streamPipeline(source, gzip, target);

  return {
    tables,
    rows,
    totalRows: Object.values(rows).reduce((sum, count) => sum + count, 0),
  };

  async function* generate(): AsyncGenerator<string> {
    yield `${JSON.stringify({
      v: 1,
      createdAt: new Date().toISOString(),
      tables,
    })}\n`;

    for (const table of tables) {
      rows[table] = 0;

      /**
       * `connection.query(...).stream()` нь мөрийг нэг нэгээр өгнө.
       * Pool-оос холболтыг ГАРААР авна: урсгал дуустал тэр холболт эзлэгдэх
       * тул `pool.query`-ийн автомат буцаалт энд тохирохгүй.
       */
      const connection = await pool.getConnection();

      try {
        /**
         * `.stream()` нь mysql2-ийн CALLBACK API дээр л байдаг. Promise
         * боодол нь бүх мөрийг санах ойд цуглуулж байж буцаадаг тул урсгал
         * авахын тулд доод давхаргын холболт руу шууд хандана.
         */
        const raw = connection.connection as unknown as CallbackConnection;
        const stream = raw.query(`select * from \`${table}\``).stream();

        for await (const row of stream) {
          const record = row as Record<string, unknown>;

          /**
           * Нууц тохиргооны мөрийг БҮХЭЛД нь алгасна.
           *
           * ⚠ Багана нь `setting_key` (`key` нь MySQL-ийн нөөцлөгдсөн үг тул
           * ингэж нэрлэсэн). Энэ урсгал нь Drizzle-ээр биш ТҮҮХИЙ SQL-ээр
           * уншдаг учир талбарын нэр нь баазынхаараа ирнэ — Drizzle-ийн
           * `key` гэсэн нэрээр хайвал ҮРГЭЛЖ `undefined` гарч, шүүлтүүр
           * чимээгүй ажиллахгүй өнгөрнө (яг ингэж алдаа гарч байсан).
           */
          if (
            table === "settings" &&
            SECRET_SETTING_KEYS.has(String(record.setting_key))
          ) {
            continue;
          }

          rows[table] += 1;

          const encoded: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(record)) {
            encoded[key] = encodeValue(value);
          }

          yield `${JSON.stringify({ t: table, r: encoded })}\n`;
        }
      } finally {
        connection.release();
      }
    }

    yield `${JSON.stringify({ done: true, rows })}\n`;
  }
}
