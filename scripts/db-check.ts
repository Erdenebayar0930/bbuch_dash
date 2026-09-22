/**
 * Өгөгдлийн сангийн эрүүл мэндийн шалгалт — Postgres-руу хөрвүүлэлтийн дараа
 * "чимээгүй эвдрэх" цэгүүдийг шалгана.
 *
 * Ажиллуулах:
 *   npm run db:check
 *
 * Гарах код: аль нэг шалгалт FAIL болбол 1 — CI/deploy скриптэд шууд орно.
 *
 * Шаардлагатай env (.env.local): DATABASE_URL
 */
import { getTableName, is, Table } from "drizzle-orm";

import { createDbPool, resolveDatabaseUrl } from "../src/lib/db/createPool";
import * as schema from "../src/lib/db/schema";

type Status = "PASS" | "WARN" | "FAIL";

const results: { status: Status; name: string; detail: string }[] = [];

function record(status: Status, name: string, detail: string) {
  results.push({ status, name, detail });
  const icon = status === "PASS" ? "✓" : status === "WARN" ? "!" : "✗";
  console.log(`${icon} ${name.padEnd(28)} ${detail}`);
}

const connectionString = resolveDatabaseUrl();
if (!connectionString) {
  console.error("DATABASE_URL (эсвэл MYSQL_URL) тохируулаагүй байна (.env.local).");
  process.exit(1);
}

/** Нууц үгийг лог руу гаргахгүй — зөвхөн хост/сан харуулна */
function describeTarget(uri: string): string {
  try {
    const url = new URL(uri);
    return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
  } catch {
    return "(DATABASE_URL задлах боломжгүй)";
  }
}

const pool = createDbPool(connectionString);

/** 1. Холболт ба серверийн хувилбар */
async function checkConnection() {
  const { rows } = await pool.query<{ version: string }>("SELECT version()");
  const version = rows[0]?.version ?? "?";

  record(
    /postgresql/i.test(version) ? "PASS" : "FAIL",
    "Серверийн хувилбар",
    version
  );
}

/**
 * 2. Огнооны бүтэн эргэлт — timestamptz бичээд уншихад ижил мөч гарч байна уу.
 *
 * Postgres-ийн `timestamptz` нь дотооддоо UTC-гээр хадгалж, session-оос үл
 * хамааран зөв утга буцаадаг тул MySQL-д хэрэгтэй байсан цагийн бүс
 * тохиргоо шаардлагагүй — гэхдээ бодит холболт дээр нотолж үзнэ.
 */
async function checkTimestampRoundTrip() {
  const connection = await pool.connect();

  try {
    await connection.query(
      "CREATE TEMPORARY TABLE _tz_probe (id INT PRIMARY KEY, written TIMESTAMPTZ NOT NULL, defaulted TIMESTAMPTZ NOT NULL DEFAULT now())"
    );

    const sent = new Date();
    await connection.query(
      "INSERT INTO _tz_probe (id, written) VALUES (1, $1)",
      [sent]
    );

    const { rows } = await connection.query(
      "SELECT written, defaulted FROM _tz_probe WHERE id = 1"
    );
    const readBack = rows[0].written as Date;
    const defaulted = rows[0].defaulted as Date;

    const writeDrift = Math.abs(readBack.getTime() - sent.getTime());
    const serverDrift = Math.abs(defaulted.getTime() - sent.getTime());

    record(
      writeDrift < 1500 ? "PASS" : "FAIL",
      "Огноо бичих/унших",
      writeDrift < 1500
        ? `зөрүү ${writeDrift}ms`
        : `${Math.round(writeDrift / 3600_000)} цагийн зөрүү`
    );

    record(
      serverDrift < 5000 ? "PASS" : "FAIL",
      "defaultNow() (сервер тал)",
      serverDrift < 5000 ? `зөрүү ${serverDrift}ms` : `${Math.round(serverDrift / 3600_000)} цагийн зөрүү`
    );

    await connection.query("DROP TABLE _tz_probe");
  } finally {
    connection.release();
  }
}

/**
 * 3. DECIMAL нь МӨР хэвээр ирэх ёстой.
 *
 * `transactions.amount` нь decimal(14,2). Драйвер үүнийг JS number болговол
 * мөнгөн дүн нарийвчлалаа алдана (0.1 + 0.2 асуудал). node-postgres нь
 * numeric-ийг анхдагчаар мөр болгож буцаадаг.
 */
async function checkDecimalAsString() {
  const { rows } = await pool.query<{ amount: unknown }>(
    "SELECT CAST('12345678901.99' AS DECIMAL(14,2)) AS amount"
  );
  const isString = typeof rows[0]?.amount === "string";

  record(
    isString ? "PASS" : "FAIL",
    "DECIMAL → мөр",
    isString ? `"${rows[0].amount}"` : `${typeof rows[0]?.amount} ирлээ`
  );
}

/**
 * 4. jsonb баганын бүтэн эргэлт.
 */
async function checkJsonRoundTrip() {
  const connection = await pool.connect();

  try {
    await connection.query(
      "CREATE TEMPORARY TABLE _json_probe (id INT PRIMARY KEY, payload JSONB NOT NULL)"
    );

    const sent = ["Улаанбаатар", "Дархан"];
    await connection.query(
      "INSERT INTO _json_probe (id, payload) VALUES (1, $1)",
      [JSON.stringify(sent)]
    );

    const { rows } = await connection.query(
      "SELECT payload FROM _json_probe WHERE id = 1"
    );
    const parsed = rows[0].payload;

    const ok =
      Array.isArray(parsed) && parsed.length === 2 && parsed[0] === "Улаанбаатар";

    record(
      ok ? "PASS" : "FAIL",
      "JSON бүтэн эргэлт",
      ok ? "драйвер объектоор буцаав" : `задлахад амжилтгүй: ${JSON.stringify(parsed)?.slice(0, 80)}`
    );

    await connection.query("DROP TABLE _json_probe");
  } finally {
    connection.release();
  }
}

/** 5. schema.ts дахь хүснэгтүүд бодит санд байгаа эсэх (drift илрүүлэлт) */
async function checkTables() {
  const expected = Object.values(schema)
    .filter((value) => is(value, Table))
    .map((value) => getTableName(value as unknown as Table))
    .sort();

  const { rows } = await pool.query<{ name: string }>(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
  );
  const actual = new Set(rows.map((r) => r.name));

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
    record("WARN", "Схемд алга хүснэгт", `${extra.join(", ")} — schema.ts-д тодорхойлоогүй`);
  }
}

/** 6. Pool-ын хэмжээ серверийн хязгаараас хэтрээгүй эсэх */
async function checkPoolSize() {
  const { rows } = await pool.query<{ max: string }>(
    "SHOW max_connections"
  );

  const poolMax = Number(process.env.DATABASE_POOL_MAX ?? 5);
  const serverMax = Number(rows[0]?.max ?? 100);
  const ok = poolMax < serverMax;

  record(
    ok ? "PASS" : "WARN",
    "Холболтын хязгаар",
    `pool ${poolMax} / сервер ${serverMax}${ok ? "" : " — DATABASE_POOL_MAX хэт өндөр"}`
  );
}

async function main() {
  console.log(`Шалгаж буй сан: ${describeTarget(connectionString!)}\n`);

  await checkConnection();
  await checkTimestampRoundTrip();
  await checkDecimalAsString();
  await checkJsonRoundTrip();
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
