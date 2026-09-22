import { Pool } from "pg";

/**
 * Холболтын мөрийг аль env хувьсагчаас авахыг шийднэ.
 *
 * `MYSQL_URL` нь `DATABASE_URL`-аас ДАВУУ эрхтэй. Шалтгаан нь практик:
 * hosting самбарууд `DATABASE_URL` гэдэг нэрийг өөрсдийн интеграцад
 * ашиглаж, хадгалахгүй байх эсвэл хуучин утгыг барих нь тохиолддог. Тийм
 * үед платформ хөндөхгүй өөр нэр өгөх нь цорын ганц гарц болно.
 *
 * Хоёулаа байвал `MYSQL_URL` ялна — өөрөөр хэлбэл гацсан `DATABASE_URL`-ыг
 * устгах шаардлагагүй, зүгээр л дээрээс нь дарж бичнэ.
 *
 * ⚠ Нэрийг (`MYSQL_URL`) тухайн платформтой ЗАРИМ hosting самбар дээр аль
 * хэдийн тохируулсан тул хэвээр үлдэв — Postgres-руу шилжсэн ч уян
 * хамаарлаа тасалдуулахгүйн тулд.
 */
export function resolveDatabaseUrl(): string | undefined {
  return process.env.MYSQL_URL || process.env.DATABASE_URL || undefined;
}

/** Холболтын мөр аль хувьсагчаас ирснийг хэлнэ — оношилгоонд хэрэгтэй */
export function databaseUrlSource(): "MYSQL_URL" | "DATABASE_URL" | null {
  if (process.env.MYSQL_URL) return "MYSQL_URL";
  if (process.env.DATABASE_URL) return "DATABASE_URL";
  return null;
}

/**
 * Postgres pool — апп болон CLI скриптүүд хоёулаа эндээс авна.
 *
 * `server-only`-г ЗОРИУДААР импортлохгүй: `scripts/`-ийн tsx скриптүүд ч энэ
 * файлыг ашиглана. Сервер талын хамгаалалт нь `./index.ts`-д байна.
 */
export function createDbPool(
  connectionString: string,
  /**
   * Холболтын дээд тоо. Ихэвчлэн env-ээс авна, гэвч backup зэрэг ганц
   * холболтоор УДААН ажилладаг ажилд 1 өгч, shared hosting дээрх хомс
   * холболтыг хэрэглэгчийн хүсэлтэд үлдээнэ.
   */
  connectionLimit = Number(process.env.DATABASE_POOL_MAX ?? 5)
): Pool {
  // ТАЙЛБАР: Postgres-ийн `timestamptz` нь дотооддоо UTC-гээр хадгалж,
  // session-оос үл хамааран зөв утга буцаадаг тул MySQL-д хэрэгтэй байсан
  // драйвер/session талын цагийн бүс тохиргоо (`timezone: "Z"`,
  // `SET time_zone = '+00:00'`) шаардлагагүй болсон.
  return new Pool({
    connectionString,
    max: connectionLimit,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    /**
     * DATABASE_SSL: "require" — жинхэнэ сертификат шалгана
     *               "relaxed" — өөрийн гарын үсэгтэй сертификат зөвшөөрнө
     *               тохируулаагүй / "disable" — SSL хэрэглэхгүй (нэг серверийн дотор)
     */
    ssl:
      process.env.DATABASE_SSL === "relaxed"
        ? { rejectUnauthorized: false }
        : process.env.DATABASE_SSL === "require"
          ? true
          : undefined,
  });
}
