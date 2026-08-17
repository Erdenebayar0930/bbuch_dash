import mysql from "mysql2/promise";

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
 * MySQL/MariaDB pool — апп болон CLI скриптүүд хоёулаа эндээс авна.
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
): mysql.Pool {
  const pool = mysql.createPool({
    uri: connectionString,
    connectionLimit,
    idleTimeout: 10_000,
    connectTimeout: 10_000,
    /**
     * Бүх холболт завгүй үед хүсэлтийг ДАРААЛАЛД оруулна, гэхдээ дараалал
     * ХЯЗГААРТАЙ.
     *
     * mysql2-ийн анхдагч нь `queueLimit: 0` буюу ХЯЗГААРГҮЙ дараалал. Ачаалал
     * ихсэхэд энэ нь хамгийн муу зан үйл өгдөг: хүсэлтүүд хариу ч авахгүй,
     * алдаа ч өгөхгүй зүгээр л хуримтлагдана. Эцэст нь Passenger-ийн таймаут
     * ажиллаж, хэрэглэгч 502 хардаг. Хязгаартай бол mysql2 тэр дор нь алдаа
     * өгөх ба апп түүнийг 503 болгож буцаана.
     *
     * ⚠ ХЭМЖЭЭ НЬ ЧУХАЛ. Эхлээд `connectionLimit × 4` (=12) байсныг ачааллын
     * хэмжилт унагаав: API хүсэлт бүр 2-3 асуулга явуулдаг тул 20 зэрэг
     * хэрэглэгч ЭНГИЙН үед ч дарааллыг тэр дороо дүүргэж, throughput 3000-аас
     * 5 хүс/сек болж НУРЖ байв. Өөрөөр хэлбэл хамгаалалт нь өөрөө гэмтэл
     * үүсгэж байсан хэрэг.
     *
     * Асуулгууд 1-2ms байдаг тул 100 урттай дараалал ~70ms дотор цэвэрлэгдэнэ
     * — хэрэглэгч мэдэхгүй. Гэхдээ хязгааргүй биш хэвээр: сан үнэхээр
     * зогсвол хуримтлал тодорхой цэг дээр таслагдана.
     */
    waitForConnections: true,
    queueLimit: Number(process.env.DATABASE_QUEUE_LIMIT ?? 100),
    /**
     * Драйвер талд: DATETIME/TIMESTAMP мөрийг UTC гэж уншина.
     * ⚠ Энэ ГАНЦААРАА хангалтгүй — доорх `SET time_zone`-ыг үзнэ үү.
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

  /**
   * ХОЛБОЛТ БҮРИЙН session цагийн бүсийг UTC болгоно.
   *
   * TIMESTAMP багана дотооддоо UTC-гээр хадгалагддаг ч сервер нь бичих/унших
   * бүрд SESSION-ы бүсээр хөрвүүлдэг. Үүнийг тогтоохгүй бол:
   *   • `defaultNow()` (= current_timestamp()) серверийн локал бүсээр үүснэ
   *   • уншихад мөн локал бүсээр буцна
   *   • харин драйвер дээрх `timezone: "Z"` түүнийг UTC гэж үзнэ
   * → огноо бүр серверийн бүсийн хэмжээгээр (Монголд +8 цаг) гажина.
   *
   * mysql2 нь энэ query-г шинэ холболт дээр бусад асуулгаас ӨМНӨ дараалалд
   * оруулдаг тул уралдах эрсдэлгүй.
   */
  pool.on("connection", (connection) => {
    connection.query("SET time_zone = '+00:00'");
  });

  return pool;
}
