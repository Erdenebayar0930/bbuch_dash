import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Postgres холболт.
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

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL тохируулаагүй байна. .env.local файлдаа нэмнэ үү."
    );
  }

  const pool =
    globalForDb.__pgPool ??
    new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      // DATABASE_SSL: "require" — жинхэнэ сертификат шалгана
      //               "relaxed" — өөрийн гарын үсэгтэй сертификат зөвшөөрнө
      //               тохируулаагүй — SSL хэрэглэхгүй (локал сервер)
      ssl:
        process.env.DATABASE_SSL === "relaxed"
          ? { rejectUnauthorized: false }
          : process.env.DATABASE_SSL === "require"
            ? true
            : undefined,
    });

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
