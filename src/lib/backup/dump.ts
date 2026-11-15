import { createGzip } from "node:zlib";
import { Readable, pipeline } from "node:stream";
import { promisify } from "node:util";

import type { Pool } from "pg";
import type { Writable } from "node:stream";

const streamPipeline = promisify(pipeline);

/**
 * Өгөгдлийн сангийн бүрэн хуулбарыг NDJSON + gzip болгож гаргана.
 *
 * ЯАГААД pg_dump БИШ ВЭ: shared hosting дээр аппын хэрэглэгчид shell
 * хандалт, `pg_dump` binary байхгүй байж болно. Тиймээс хуулбарыг драйвераар
 * өөрөө унших ёстой.
 *
 * ЯАГААД БАГЦААР (batch) ВЭ: Passenger процесс нь санах ойн хатуу
 * хязгаартай. Бүх мөрийг массивт цуглуулбал том хүснэгт дээр процесс OOM-оор
 * унаж, УГ НЬ АЖИЛЛАЖ БАЙСАН аппыг хамт унагана. Хүснэгтийг `LIMIT/OFFSET`-ээр
 * багц багцаар уншиж бичих нь санах ойн хэрэглээг багцын хэмжээгээр хязгаарлана.
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

/** Нэг удаад уншиж бичих мөрийн тоо */
const BATCH_SIZE = 500;

/** Драйвераас ирсэн утгыг JSON-д аюулгүй хэлбэрт буулгана. */
function encodeValue(value: unknown): unknown {
  if (value instanceof Date) {
    // Postgres timestamptz нь UTC-гээр хадгалагддаг тул ISO мөр найдвартай.
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return { __buffer: value.toString("base64") };
  }

  /**
   * jsonb багана.
   *
   * node-postgres драйвер jsonb-г ЗАДАЛЖ объект/массив болгож өгдөг. Задарсан
   * утгыг тэмдэглэж хадгална — сэргээхэд параметрчилсан insert руу шууд JS
   * утга дамжуулбал драйвер өөрөө jsonb болгож бичдэг.
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

    // jsonb баганад JS утгыг шууд дамжуулна — драйвер өөрөө jsonb болгоно
    if ("__json" in wrapper) {
      return JSON.parse(String(wrapper.__json));
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

/**
 * Нөөцлөх Postgres schema-ууд. `tahilt` нь Тахилтын цэсийн өгөгдөл
 * (@see lib/db/schema.ts → tahiltSchema). Шинэ schema нэмбэл ЭНД нэмнэ —
 * эс бөгөөс түүний өгөгдөл нөөцлөгдөхгүй.
 */
export const BACKUP_SCHEMAS = ["public", "tahilt"] as const;

/**
 * Архив доторх хүснэгтийн нэр: `public`-ийнх нь хуучин шигээ зөвхөн нэр
 * (`users`), бусад schema-гийнх `schema.нэр` (`tahilt.revelations`). Ингэснээр
 * хуучин архив өөрчлөлтгүй сэргээгдэнэ.
 */
export const archiveName = (schema: string, table: string) =>
  schema === "public" ? table : `${schema}.${table}`;

/** Архивын нэрийг schema ба хүснэгт болгон задална */
export function splitArchiveName(name: string): { schema: string; table: string } {
  const dot = name.indexOf(".");
  return dot === -1
    ? { schema: "public", table: name }
    : { schema: name.slice(0, dot), table: name.slice(dot + 1) };
}

/**
 * SQL-д бичих хүснэгтийн нэр — `"users"` эсвэл `"tahilt"."revelations"`.
 * Нэрс нь баазаас уншсан жагсаалттай тулгагдсан байх ёстой (дурын мөр биш).
 */
export function quoteTable(name: string): string {
  const { schema, table } = splitArchiveName(name);
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return schema === "public" ? quote(table) : `${quote(schema)}.${quote(table)}`;
}

/** Санд БОДИТООР байгаа хүснэгтүүд — схемийн жагсаалтад найдахгүй */
export async function listTables(pool: Pick<Pool, "query">): Promise<string[]> {
  const { rows } = await pool.query<{ table_schema: string; table_name: string }>(
    "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = ANY($1) AND table_type = 'BASE TABLE'",
    [BACKUP_SCHEMAS]
  );

  return rows.map((row) => archiveName(row.table_schema, row.table_name)).sort();
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
      let offset = 0;

      for (;;) {
        const { rows: batch } = await pool.query(
          `select * from ${quoteTable(table)} order by 1 limit ${BATCH_SIZE} offset ${offset}`
        );

        if (batch.length === 0) break;
        offset += batch.length;

        for (const row of batch) {
          const record = row as Record<string, unknown>;

          /**
           * Нууц тохиргооны мөрийг БҮХЭЛД нь алгасна.
           *
           * ⚠ Багана нь `setting_key` (`key` нь SQL-ийн нөөцлөгдсөн үг тул
           * ингэж нэрлэсэн).
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

        if (batch.length < BATCH_SIZE) break;
      }
    }

    yield `${JSON.stringify({ done: true, rows })}\n`;
  }
}
