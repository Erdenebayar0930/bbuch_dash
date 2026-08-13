/**
 * MySQL дэх эрх/төлөвийг бүх хэрэглэгчийн Firebase токен руу хуулна.
 *
 * Ажиллуулах:
 *   npm run sync:claims           # юу өөрчлөгдөхийг харуулна, БИЧИХГҮЙ
 *   npm run sync:claims -- --write
 *
 * ЭНЭ НЬ ЗААВАЛ ШААРДЛАГАТАЙ БИШ. Ердийн үед claim нь өөрөө засагдана:
 * хэрэглэгч API руу хандах бүрд `getCaller` нь токен доторх хуулбарыг MySQL-тэй
 * харьцуулж, зөрвөл чимээгүй нөхдөг (src/lib/api/claims.ts). Энэ скрипт нь
 * бөөнөөр нь шалгах, эсвэл хэзээ ч нэвтрээгүй хэрэглэгчийн claim-ийг урьдчилж
 * бичих зэрэгт хэрэгтэй.
 *
 * ⚠⚠ ХАМГИЙН АЮУЛТАЙ АЛДАА: Firebase төсөл НЭГ л ширхэг байдаг ч бааз нь
 * орчин тус бүрд өөр. Локал баазаас `--write` хийвэл ЛОКАЛ тестийн эрхийг
 * БОДИТ хэрэглэгчид рүү бичнэ. Тиймээс скрипт нь ажиллахаасаа өмнө аль бааз,
 * аль Firebase төсөл рүү хандаж байгаагаа заавал хэвлэдэг — уншиж баталгаажуулна
 * уу. Локал бааз руу заасан байвал `--write` нь ажиллахгүй (доорх шалгалт).
 *
 * Шаардлагатай env (.env.local):
 *   DATABASE_URL (эсвэл MYSQL_URL)
 *   FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { drizzle } from "drizzle-orm/mysql2";

import { getFirebaseAdminConfig } from "../src/lib/config";
import { createDbPool, resolveDatabaseUrl } from "../src/lib/db/createPool";
import { users } from "../src/lib/db/schema";

const write = process.argv.includes("--write");

const connectionString = resolveDatabaseUrl();
if (!connectionString) {
  console.error("DATABASE_URL (эсвэл MYSQL_URL) тохируулаагүй байна (.env.local).");
  process.exit(1);
}

// Түлхүүрийн задаргааг гараар хийхгүй — hosting самбар бүр `\n`-ийг өөрөөр
// хадгалдаг тул апп нь тэвчээртэй задлагчтай. Түүнийг л ашиглана.
const { projectId, clientEmail, privateKey } = getFirebaseAdminConfig();

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY тохируулаагүй байна."
  );
  process.exit(1);
}

/**
 * Аль бааз, аль Firebase төсөл рүү хандаж байгааг ил хэвлэнэ.
 *
 * Локал бааз руу заасан үед `--write` хийвэл локал тестийн эрх бодит
 * хэрэглэгчид рүү очих тул шууд зогсооно. Прод баазаас ажиллуулах шаардлагатай
 * үед `--i-know-the-target` тугаар давж болно (жишээ нь SSH-ээр серверээс,
 * эсвэл локалаас прод холболтын мөр тохируулсан үед).
 */
function describeTarget(uri: string) {
  try {
    const url = new URL(uri);
    return { host: url.hostname, db: url.pathname.slice(1), user: url.username };
  } catch {
    return { host: "(задрахгүй)", db: "?", user: "?" };
  }
}

const target = describeTarget(connectionString);
const isLocalDb = ["localhost", "127.0.0.1", "::1"].includes(target.host);
const override = process.argv.includes("--i-know-the-target");

console.log("Бааз    :", `${target.user}@${target.host}/${target.db}`);
console.log("Firebase:", projectId);
console.log();

if (write && isLocalDb && !override) {
  console.error(
    "⛔ Бааз нь ЛОКАЛ атлаа Firebase нь дундын төсөл байна.\n" +
      "   Ингэж бичвэл локал тестийн эрх бодит хэрэглэгчид рүү очно.\n" +
      "   Прод баазаас ажиллуулна уу. Үнэхээр зөв гэдэгт итгэлтэй бол:\n" +
      "     npm run sync:claims -- --write --i-know-the-target"
  );
  process.exit(1);
}

const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const auth = getAuth(app);

const pool = createDbPool(connectionString);
const db = drizzle(pool, { mode: "default" });

type Outcome = "шинэчилсэн" | "аль хэдийн зөв" | "Firebase-д алга" | "алдаа";

async function main() {
  const rows = await db
    .select({ uid: users.uid, email: users.email, role: users.role, status: users.status })
    .from(users);

  console.log(
    `${rows.length} хэрэглэгч олдлоо. Горим: ${write ? "БИЧНЭ" : "зөвхөн харуулна (--write нэмнэ үү)"}\n`
  );

  const tally: Record<Outcome, number> = {
    "шинэчилсэн": 0,
    "аль хэдийн зөв": 0,
    "Firebase-д алга": 0,
    "алдаа": 0,
  };

  for (const row of rows) {
    const want = { role: row.role ?? "user", status: row.status ?? "pending" };
    let outcome: Outcome;
    let detail = "";

    try {
      const record = await auth.getUser(row.uid);
      const have = (record.customClaims ?? {}) as Partial<typeof want>;

      if (have.role === want.role && have.status === want.status) {
        outcome = "аль хэдийн зөв";
      } else {
        detail = `${have.role ?? "—"}/${have.status ?? "—"} → ${want.role}/${want.status}`;
        // Мөр бүрийг дарж бичнэ — өмнөх claim-ийг нэгтгэхгүй. Энэ талбарууд нь
        // MySQL-ээс бүрэн гардаг тул нэгтгэх нь хуучин утгыг л амьд үлдээнэ.
        if (write) await auth.setCustomUserClaims(row.uid, want);
        outcome = "шинэчилсэн";
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      // MySQL-д мөр байгаа ч Firebase дээр данс нь устсан байж болно
      if (code === "auth/user-not-found") {
        outcome = "Firebase-д алга";
      } else {
        outcome = "алдаа";
        detail = error instanceof Error ? error.message : String(error);
      }
    }

    tally[outcome] += 1;

    if (outcome !== "аль хэдийн зөв") {
      console.log(`  ${outcome.padEnd(16)} ${row.email ?? row.uid}  ${detail}`);
    }
  }

  console.log("\nДүн:");
  for (const [key, count] of Object.entries(tally)) {
    if (count > 0) console.log(`  ${key.padEnd(16)} ${count}`);
  }

  if (!write && tally["шинэчилсэн"] > 0) {
    console.log("\nБичихийн тулд:  npm run sync:claims -- --write");
  }

  if (write && tally["шинэчилсэн"] > 0) {
    console.log(
      "\n⚠ Claim нь хэрэглэгчийн ДАРААГИЙН токен сэргээлтээс хүчинтэй болно" +
        " (ихдээ 1 цаг). storage.rules-ийг чангатгахаас өмнө хүлээнэ үү."
    );
  }

  // Алдаатай мөр байвал 0-ээс ялгаатай кодоор гарна — CI/скриптэд баригдана
  process.exit(tally["алдаа"] > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
