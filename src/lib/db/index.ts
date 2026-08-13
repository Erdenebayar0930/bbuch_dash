import "server-only";

import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";

import { createDbPool } from "./createPool";
import * as schema from "./schema";

import type { Pool } from "mysql2/promise";

type Database = MySql2Database<typeof schema>;

/**
 * MySQL холболт.
 *
 * Pool болон drizzle instance-ыг ЗАЛХУУ (lazy) үүсгэнэ — build үед route-уудын
 * модулийг ачаалахад DATABASE_URL байхгүй байж болно, тэр үед унах ёсгүй.
 * Мөн serverless орчинд холболт хуримтлагдахаас сэргийлж global дээр кэшлэнэ.
 */
const globalForDb = globalThis as unknown as {
  __mysqlPool?: Pool;
  __drizzle?: Database;
};

function getDb(): Database {
  if (globalForDb.__drizzle) return globalForDb.__drizzle;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL тохируулаагүй байна. .env.local файлдаа нэмнэ үү."
    );
  }

  const pool = globalForDb.__mysqlPool ?? createDbPool(connectionString);

  globalForDb.__mysqlPool = pool;
  globalForDb.__drizzle = drizzle(pool, { schema, mode: "default" });

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
