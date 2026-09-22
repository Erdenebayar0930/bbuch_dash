import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

import { createDbPool, resolveDatabaseUrl } from "./createPool";
import * as schema from "./schema";

import type { Pool } from "pg";

type Database = NodePgDatabase<typeof schema>;

/**
 * Postgres холболт.
 *
 * `server-only`-г ЗОРИУДААР импортлохгүй: `scripts/`-ийн tsx скриптүүд ч
 * (жишээ нь `npm run backup`) энэ холболтыг ашиглана. Сервер талын
 * хамгаалалт нь `./index.ts`-д — аппын код тэндээс импортлоно.
 *
 * Pool болон drizzle instance-ыг ЗАЛХУУ (lazy) үүсгэнэ — build үед route-уудын
 * модулийг ачаалахад DATABASE_URL байхгүй байж болно, тэр үед унах ёсгүй.
 * Мөн serverless орчинд холболт хуримтлагдахаас сэргийлж global дээр кэшлэнэ.
 */
const globalForDb = globalThis as unknown as {
  __pgPool?: Pool;
  __drizzle?: Database;
};

function getDb(): Database {
  if (globalForDb.__drizzle) return globalForDb.__drizzle;

  const connectionString = resolveDatabaseUrl();

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL (эсвэл MYSQL_URL) тохируулаагүй байна. .env.local файлдаа нэмнэ үү."
    );
  }

  const pool = globalForDb.__pgPool ?? createDbPool(connectionString);

  globalForDb.__pgPool = pool;
  globalForDb.__drizzle = drizzle(pool, { schema });

  return globalForDb.__drizzle;
}

/**
 * `db.select()...` гэж шууд ашиглана — эхний хандалтад л холболт үүснэ.
 */
export const db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    return Reflect.get(getDb(), property, receiver);
  },
});

export { schema };
