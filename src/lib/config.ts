export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  vapidKey?: string;
}

export interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * Client талын нөөц утга.
 *
 * Эдгээр нь нууц БИШ — Firebase-ийн web түлхүүр хөтөч рүү ил очдог бөгөөд
 * хамгаалалт нь Firebase-ийн дүрэм дээр тогтдог. Тиймээс энд байрлуулах нь
 * аюулгүйн эрсдэл биш.
 *
 * ⚠ ГЭВЧ энэ нь тохиргоо дутуугийн шинжийг НУУДАГ: env хувьсагч байхгүй үед
 * нэвтрэх нь ажиллаад, сервер тал нь (`FIREBASE_*` admin түлхүүр, DATABASE_URL)
 * ажиллахгүй үлддэг. Ингэснээр апп "хагас эрүүл" харагдаж, эрх шалгах дэлгэц
 * дээр гацдаг байв. Тиймээс нөөц утга хэрэглэгдсэн эсэхийг доор ил гаргаж,
 * `/api/health`-д мэдээлнэ.
 */
const fallbackFirebaseClientConfig: FirebaseClientConfig = {
  apiKey: "AIzaSyB9fXul1pKxb_IJ2nqvlfeIP3qtXT7jYLg",
  authDomain: "bbuch-edba7.firebaseapp.com",
  projectId: "bbuch-edba7",
};

/**
 * Client тохиргоог env-ээс бүрэн авч чадсан эсэх.
 *
 * `false` бол дээрх нөөц утга ажиллаж байна — өөрөөр хэлбэл build хийх үед
 * `NEXT_PUBLIC_FIREBASE_*` тохируулагдаагүй байсан гэсэн үг.
 */
export function isFirebaseClientConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

export function getFirebaseClientConfig(): FirebaseClientConfig {
  if (!isFirebaseClientConfigured()) {
    console.warn(
      "[config] NEXT_PUBLIC_FIREBASE_* тохируулаагүй тул нөөц утга ашиглаж " +
        "байна. Нэвтрэх нь ажиллах ч сервер талын эрх шалгалт бүтэлгүйтэж " +
        "болзошгүй — /api/health-ыг шалгана уу."
    );
  }

  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || fallbackFirebaseClientConfig.projectId;

  return {
    ...fallbackFirebaseClientConfig,
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || fallbackFirebaseClientConfig.apiKey,
    authDomain:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || fallbackFirebaseClientConfig.authDomain,
    projectId,
    // Bucket заагаагүй бол шинэ төслүүдийн үндсэн нэр рүү унана — хоосон
    // үлдээвэл getStorage() алдаа өгнө.
    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "",
  };
}

/**
 * Service account-ын PEM түлхүүрийг задлана.
 *
 * Түлхүүрийг орчны хувьсагчид байрлуулах нь мөр таслалтаас болж найдваргүй:
 * hosting панелиуд утгыг ямар хэлбэрээр хадгалахаа өөрсдөө шийддэг. Бодит
 * байршуулалт дээр (bodyLength 1654) хоёр гажилт ЗЭРЭГ илэрсэн:
 *
 *   • хашилт нь утгын ХЭСЭГ болж үлдсэн  → `"-----BEGIN…-----\n…"`
 *   • backslash нь давхар escape хийгдсэн → `\\n` (жинхэнэ `\n`-ий оронд)
 *
 * Аль аль нь `createPrivateKey()`-г "DECODER routines::unsupported" алдаагаар
 * унагаадаг ба алдааны мессеж нь шалтгааныг огт заадаггүй. Панелийн зан үйлийг
 * бид хянах боломжгүй тул задаргааг нь энд тэвчээртэй болгов.
 *
 * base64-ийн их бие backslash агуулдаггүй тул `\\+n` → мөр таслалт гэсэн
 * хөрвүүлэлт зөв утгыг гэмтээхгүй.
 */
function normalizePrivateKey(raw: string | undefined): string {
  if (!raw) return "";

  let key = raw.trim();

  // Хашилтыг зөвхөн хос байвал хуулна — түлхүүрийн дотор хашилт байхгүй.
  // `.` нь мөр таслалтыг барихгүй тул `[\s\S]` — `s` флаг нь tsconfig-ийн
  // target-аас өндөр ES хувилбар шаардана.
  if (/^(["'])[\s\S]*\1$/.test(key)) {
    key = key.slice(1, -1);
  }

  return key.replace(/\\+n/g, "\n");
}

export function getFirebaseAdminConfig(): FirebaseAdminConfig {
  return {
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
    privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  };
}

export function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
