/**
 * Өгөгдлийн сангийн эрүүл мэндийн шалгалт — PG → MySQL хөрвүүлэлтийн дараа
 * "чимээгүй эвдрэх" бүх цэгийг нэг дор шалгана.
 *
 * Ажиллуулах:
 *   npm run db:check
 *
 * `src/lib/db/createPool.ts` дахь тохиргоо бүр (UTC цагийн бүс, DECIMAL-ыг
 * мөрөөр буцаах, utf8mb4) нь ЗӨВХӨН тайлбараар нотлогдож байсан — энэ скрипт
 * тэдгээрийг бодит сервер дээр шалгаж, зөрвөл алдаа буцаана. Байршуулалтын
 * дараа эсвэл шинэ сервер дээр эхлүүлэхэд ажиллуулна.
 *
 * Гарах код: аль нэг шалгалт FAIL болбол 1 — CI/deploy скриптэд шууд орно.
 *
 * Шаардлагатай env (.env.local): DATABASE_URL
 */
import { getTableName, is, Table } from "drizzle-orm";

import { createDbPool } from "../src/lib/db/createPool";
import * as schema from "../src/lib/db/schema";

import type { Pool, RowDataPacket } from "mysql2/promise";

type Status = "PASS" | "WARN" | "FAIL";

const results: { status: Status; name: string; detail: string }[] = [];

function record(status: Status, name: string, detail: string) {
  results.push({ status, name, detail });
  const icon = status === "PASS" ? "✓" : status === "WARN" ? "!" : "✗";
  console.log(`${icon} ${name.padEnd(28)} ${detail}`);
}

/** Нэг мөр буцаах туслах — `SELECT` бүрийг давтахгүйн тулд */
async function selectOne<T = Record<string, unknown>>(
  pool: Pool,
  sql: string,
  params: unknown[] = []
): Promise<T> {
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows[0] as T;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL тохируулаагүй байна (.env.local).");
  process.exit(1);
}

/** Нууц үгийг лог руу гаргахгүй — зөвхөн хост/сан харуулна */
function describeTarget(uri: string): string {
  try {
    const url = new URL(uri);
    return `${url.hostname}:${url.port || "3306"}${url.pathname}`;
  } catch {
    return "(DATABASE_URL задлах боломжгүй)";
  }
}

const pool = createDbPool(connectionString);

/** 1. Холболт ба серверийн хувилбар */
async function checkConnection() {
  const row = await selectOne<{ version: string; comment: string }>(
    pool,
    "SELECT VERSION() AS version, @@version_comment AS comment"
  );

  const isMariaDb = /mariadb/i.test(`${row.version} ${row.comment}`);
  const major = Number(row.version.split(".")[0]);
  const minor = Number(row.version.split(".")[1] ?? 0);

  // schema.ts нь цонхны функц ба JSON_CONTAINS ашигладаг:
  // MySQL 8.0+ эсвэл MariaDB 10.2+ шаардана.
  const supported = isMariaDb
    ? major > 10 || (major === 10 && minor >= 2)
    : major >= 8;

  record(
    supported ? "PASS" : "FAIL",
    "Серверийн хувилбар",
    `${row.version}${isMariaDb ? " (MariaDB)" : ""}${
      supported ? "" : " — MySQL 8.0+ / MariaDB 10.2+ шаардана"
    }`
  );
}

/**
 * 2. Session-ы цагийн бүс — createPool.ts дахь `SET time_zone` хүчинтэй эсэх.
 *
 * ХОЛБОЛТ БҮР дээр шалгах ёстой: `pool.on("connection")` дэгээ шинэ холболт
 * үүсэх бүрд ажиллах учиртай. Ганц холболт шалгавал pool-оос дахин ашиглагдсан
 * холболт таарч, дэгээ ажиллаагүйг алдана.
 */
async function checkSessionTimezone() {
  const rows = await Promise.all(
    Array.from({ length: 3 }, () =>
      selectOne<{ tz: string }>(pool, "SELECT @@session.time_zone AS tz")
    )
  );

  const bad = rows.filter((r) => r.tz !== "+00:00");

  record(
    bad.length === 0 ? "PASS" : "FAIL",
    "Session цагийн бүс",
    bad.length === 0
      ? "бүх холболт +00:00 (UTC)"
      : `${bad.length}/${rows.length} холболт UTC биш: ${bad
          .map((r) => r.tz)
          .join(", ")} — pool.on("connection") дэгээ ажиллаагүй байна`
  );
}

/**
 * 3. Огнооны бүтэн эргэлт — бичээд уншихад ижил мөч гарч байна уу.
 *
 * ⚠ Тодорхой утга бичих/унших нь ГАНЦААРАА хангалтгүй шалгуур: session бүс
 * буруу байсан ч бичихдээ хөрвүүлсэн зөрүү уншихад буцаж цуцлагдах тул
 * туршилт "тэнцэнэ". Тиймээс `CURRENT_TIMESTAMP` (= `defaultNow()`)-ыг ЗААВАЛ
 * хамт шалгана — түүнийг сервер өөрөө session бүсээр үүсгэдэг учир зөрүү нь
 * цуцлагдахгүй, ил гарна.
 *
 * Бодит хүснэгт хөндөхгүйн тулд TEMPORARY хүснэгт ашиглана — тэр нь холболтод
 * уягддаг тул холболтоо түгжиж авна.
 */
async function checkTimestampRoundTrip() {
  const connection = await pool.getConnection();

  try {
    await connection.query(
      "CREATE TEMPORARY TABLE _tz_probe (id INT PRIMARY KEY, written TIMESTAMP NOT NULL, defaulted TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    );

    const sent = new Date();
    await connection.query("INSERT INTO _tz_probe (id, written) VALUES (1, ?)", [
      sent,
    ]);

    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT written, defaulted FROM _tz_probe WHERE id = 1"
    );
    const readBack = rows[0].written as Date;
    const defaulted = rows[0].defaulted as Date;

    // TIMESTAMP нь секундын нарийвчлалтай тул 1 секунд хүртэл зөрөх нь хэвийн
    const writeDrift = Math.abs(readBack.getTime() - sent.getTime());
    // defaultNow() (= CURRENT_TIMESTAMP) серверийн бүсээр үүсэх эрсдэлтэй
    const serverDrift = Math.abs(defaulted.getTime() - sent.getTime());

    record(
      writeDrift < 1500 ? "PASS" : "FAIL",
      "Огноо бичих/унших",
      writeDrift < 1500
        ? `зөрүү ${writeDrift}ms`
        : `${Math.round(writeDrift / 3600_000)} цагийн зөрүү — драйверийн timezone тохиргоо буруу`
    );

    record(
      serverDrift < 5000 ? "PASS" : "FAIL",
      "defaultNow() (сервер тал)",
      serverDrift < 5000
        ? `зөрүү ${serverDrift}ms`
        : `${Math.round(serverDrift / 3600_000)} цагийн зөрүү — session бүс UTC биш`
    );

    await connection.query("DROP TEMPORARY TABLE _tz_probe");
  } finally {
    connection.release();
  }
}

/**
 * 4. DECIMAL нь МӨР хэвээр ирэх ёстой.
 *
 * `transactions.amount` нь decimal(14,2). Драйвер үүнийг JS number болговол
 * мөнгөн дүн нарийвчлалаа алдана (0.1 + 0.2 асуудал).
 */
async function checkDecimalAsString() {
  const row = await selectOne<{ amount: unknown }>(
    pool,
    "SELECT CAST('12345678901.99' AS DECIMAL(14,2)) AS amount"
  );

  const isString = typeof row.amount === "string";

  record(
    isString ? "PASS" : "FAIL",
    "DECIMAL → мөр",
    isString
      ? `"${row.amount}"`
      : `${typeof row.amount} ирлээ — decimalNumbers: false тохиргоо алга`
  );
}

/**
 * 5. Тэмдэгтийн кодчлол — Монгол кирилл текст utf8mb4 шаардана.
 *
 * latin1 хүснэгт дээр кирилл бичвэр "?" болж чимээгүй алдагдана.
 */
async function checkCharset() {
  const dbRow = await selectOne<{ charset: string; collation: string }>(
    pool,
    "SELECT DEFAULT_CHARACTER_SET_NAME AS charset, DEFAULT_COLLATION_NAME AS collation FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()"
  );

  record(
    dbRow?.charset === "utf8mb4" ? "PASS" : "FAIL",
    "Сангийн кодчлол",
    `${dbRow?.charset ?? "?"} / ${dbRow?.collation ?? "?"}`
  );

  const [tables] = await pool.query<RowDataPacket[]>(
    "SELECT TABLE_NAME AS name, TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_COLLATION NOT LIKE 'utf8mb4%'"
  );

  record(
    tables.length === 0 ? "PASS" : "FAIL",
    "Хүснэгтийн кодчлол",
    tables.length === 0
      ? "бүх хүснэгт utf8mb4"
      : tables.map((t) => `${t.name} (${t.collation})`).join(", ")
  );
}

/**
 * 6. JSON баганын бүтэн эргэлт — `jsonCol` нь MySQL/MariaDB хоёуланд ажиллах ёстой.
 *
 * MariaDB дээр JSON нь LONGTEXT тул драйвер мөрөөр буцаана, MySQL 8-д объектоор.
 * `jsonCol.fromDriver` хоёуланг зохицуулдаг — үүнийг бодит серверт нотлоно.
 */
async function checkJsonRoundTrip() {
  const connection = await pool.getConnection();

  try {
    // `CAST(? AS JSON)` ашиглаж БОЛОХГҮЙ — MariaDB түүнийг таньдаггүй. Бодит
    // схемийнхтэй яг адил `json` багана үүсгэж шалгана.
    await connection.query(
      "CREATE TEMPORARY TABLE _json_probe (id INT PRIMARY KEY, payload JSON NOT NULL)"
    );

    const sent = ["Улаанбаатар", "Дархан"];
    await connection.query(
      "INSERT INTO _json_probe (id, payload) VALUES (1, ?)",
      [JSON.stringify(sent)]
    );

    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT payload FROM _json_probe WHERE id = 1"
    );
    const raw = rows[0].payload;

    // schema.ts дахь jsonCol.fromDriver-ийн логикийг давтана
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

    const ok =
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      parsed[0] === "Улаанбаатар";

    record(
      ok ? "PASS" : "FAIL",
      "JSON бүтэн эргэлт",
      ok
        ? `драйвер ${typeof raw === "string" ? "мөрөөр" : "объектоор"} буцаав → задарлаа`
        : `задлахад амжилтгүй: ${JSON.stringify(raw)?.slice(0, 80)}`
    );

    await connection.query("DROP TEMPORARY TABLE _json_probe");
  } finally {
    connection.release();
  }
}

/**
 * 7. sql_mode — STRICT горим унтарсан бол хэт урт утга чимээгүй тайрагдана.
 *
 * Postgres дээр энэ нь алдаа өгдөг байсан тул хөрвүүлэлтийн дараа энэ ялгаа
 * өгөгдөл алдагдахад хүргэж болно.
 */
async function checkSqlMode() {
  const row = await selectOne<{ mode: string }>(
    pool,
    "SELECT @@session.sql_mode AS mode"
  );

  const strict =
    row.mode.includes("STRICT_TRANS_TABLES") ||
    row.mode.includes("STRICT_ALL_TABLES");

  record(
    strict ? "PASS" : "WARN",
    "sql_mode (STRICT)",
    strict
      ? "STRICT идэвхтэй"
      : "STRICT унтраалттай — хэт урт утга чимээгүй тайрагдана"
  );
}

/** 8. schema.ts дахь хүснэгтүүд бодит санд байгаа эсэх (drift илрүүлэлт) */
async function checkTables() {
  // schema.ts нь хүснэгтээс гадна төрөл, туслах утга ч экспортолдог тул
  // `is()`-ээр шүүнэ. Тодорхой хүснэгт бүрийн төрөл өөр учир нэгтгэхийн тулд
  // ерөнхий `Table`-руу хөрвүүлнэ.
  const expected = Object.values(schema)
    .filter((value) => is(value, Table))
    .map((value) => getTableName(value as unknown as Table))
    .sort();

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'"
  );
  const actual = new Set(rows.map((r) => String(r.name)));

  const missing = expected.filter((name) => !actual.has(name));
  // website/ апп нь "site_" угтвартай хүснэгттэй — drizzle.config.ts үүнийг
  // шүүдэг тул энд ч илүүдэл гэж тооцохгүй.
  const extra = [...actual].filter(
    (name) => !expected.includes(name) && !name.startsWith("site_")
  );

  record(
    missing.length === 0 ? "PASS" : "FAIL",
    "Хүснэгтүүд",
    missing.length === 0
      ? `${expected.length}/${expected.length} байна`
      : `дутуу: ${missing.join(", ")} — npm run db:push ажиллуулна уу`
  );

  if (extra.length > 0) {
    record(
      "WARN",
      "Схемд алга хүснэгт",
      `${extra.join(", ")} — schema.ts-д тодорхойлоогүй`
    );
  }
}

/** 9. Pool-ын хэмжээ серверийн хязгаараас хэтрээгүй эсэх */
async function checkPoolSize() {
  const row = await selectOne<{ max: number }>(
    pool,
    "SELECT @@max_connections AS max"
  );

  const poolMax = Number(process.env.DATABASE_POOL_MAX ?? 5);
  const ok = poolMax < Number(row.max);

  record(
    ok ? "PASS" : "WARN",
    "Холболтын хязгаар",
    `pool ${poolMax} / сервер ${row.max}${
      ok ? "" : " — DATABASE_POOL_MAX хэт өндөр"
    }`
  );
}

async function main() {
  console.log(`Шалгаж буй сан: ${describeTarget(connectionString!)}\n`);

  await checkConnection();
  await checkSessionTimezone();
  await checkTimestampRoundTrip();
  await checkDecimalAsString();
  await checkCharset();
  await checkJsonRoundTrip();
  await checkSqlMode();
  await checkTables();
  await checkPoolSize();

  const failed = results.filter((r) => r.status === "FAIL").length;
  const warned = results.filter((r) => r.status === "WARN").length;

  console.log(
    `\n${results.length - failed - warned} PASS, ${warned} WARN, ${failed} FAIL`
  );

  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("\nШалгалт тасаллаа:", error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
