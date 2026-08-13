import "server-only";

import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import * as schema from "./schema";

type Database = MySql2Database<typeof schema>;

/**
 * MySQL холболт.
 *
 * Pool болон drizzle instance-ыг ЗАЛХУУ (lazy) үүсгэнэ — build үед route-уудын
 * модулийг ачаалахад DATABASE_URL байхгүй байж болно, тэр үед унах ёсгүй.
 * Мөн serverless орчинд холболт хуримтлагдахаас сэргийлж global дээр кэшлэнэ.
 */
const globalForDb = globalThis as unknown as {
  __mysqlPool?: mysql.Pool;
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
    globalForDb.__mysqlPool ??
    mysql.createPool({
      uri: connectionString,
      connectionLimit: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idleTimeout: 10_000,
      connectTimeout: 10_000,
      /**
       * ЗААВАЛ UTC. mysql2 нь анхдагчаар серверийн локал цагийн бүсээр Date
       * объектыг хөрвүүлдэг — ингэвэл бичих, унших хоёрын хооронд огноо
       * зөрнө. Схемийн бүх TIMESTAMP-ыг UTC гэж үзнэ.
       */
      timezone: "Z",
      /**
       * DECIMAL-ыг тоо БИШ мөрөөр буцаана (mysql2-ийн анхдагч). `amount` нь
       * decimal(14,2) — JS-ийн float болговол мөнгөн дүн алдаатай болно.
       */
      decimalNumbers: false,
      /**
       * DATABASE_SSL: "require" — жинхэнэ сертификат шалгана
       *               "relaxed" — өөрийн гарын үсэгтэй сертификат зөвшөөрнө
       *               тохируулаагүй — SSL хэрэглэхгүй (нэг серверийн дотор)
       */
      ssl:
        process.env.DATABASE_SSL === "relaxed"
          ? { rejectUnauthorized: false }
          : process.env.DATABASE_SSL === "require"
            ? {}
            : undefined,
    });

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
