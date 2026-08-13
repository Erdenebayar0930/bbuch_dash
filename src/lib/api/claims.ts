import "server-only";

import { adminAuth } from "@/lib/firebaseAdmin";

import type { UserRole, UserStatus } from "@/lib/permissions";

/**
 * Хэрэглэгчийн эрх/төлөвийг Firebase ID token руу хуулна (custom claims).
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ: Firebase Storage-ийн дүрэм нь MySQL рүү хандаж чаддаггүй.
 * Тиймээс `storage.rules` дотор "энэ хүн админ мөн үү" гэдгийг шалгах ганц арга
 * бол эрхийг нь ТОКЕН дотор нь суулгах. Үүнгүйгээр нэвтэрсэн ямар ч хүн —
 * баталгаажаагүй, хаагдсан ч — эд хөрөнгийн зургийг устгаж чаддаг байсан.
 *
 * ⚠ ЭНЭ НЬ MySQL ДЭЭРХ ШАЛГАЛТЫГ ОРЛОХГҮЙ. Claim нь токен дотор хөлддөг тул
 * эрх хасагдсан хүний токен нь дуусах хүртлээ (ихдээ 1 цаг) хуучин утгаа
 * барина. /api/* бүх route нь `require*` функцээр САНГААС уншиж шалгасаар байх
 * ёстой — тэр нь шууд хүчинтэй болдог. Claim нь ЗӨВХӨН Storage-д зориулсан.
 *
 * ⚠ Алдаа гарвал ШИДЭХГҮЙ. Эрхийн жинхэнэ эх сурвалж нь MySQL — claim бичиж
 * чадсангүй гэдгээр админы хийсэн өөрчлөлтийг буцаах нь илүү муу. Лог руу
 * бичээд үргэлжилнэ; `npm run sync:claims`-ээр дараа нь нөхөж болно.
 */
export type UserClaims = {
  role: UserRole;
  status: UserStatus;
};

/**
 * Сүүлд ямар утга бичсэнийг санана — ДАВТАН бичихээс сэргийлнэ.
 *
 * Claim бичсэн ч хэрэглэгчийн ГАРТ БАЙГАА токен нь хуучин хэвээр үлддэг
 * (сэргээх хүртэл ихдээ 1 цаг). Тиймээс `getCaller` дээрх зөрүүний шалгалт
 * тэр бүх хугацаанд "зөрүүтэй" гэж үзсээр байх ба хүсэлт бүрд Firebase рүү
 * бичих хүсэлт явуулна. Энэ Map нь тэрхүү давталтыг таслана.
 */
const recentlySynced = new Map<string, { value: string; at: number }>();

/** Дахин бичихийг хориглох хугацаа — токен сэргэх хугацаатай ойролцоо */
const RESYNC_COOLDOWN_MS = 10 * 60_000;

function sweep(now: number) {
  if (recentlySynced.size < 2_000) return;

  for (const [uid, entry] of recentlySynced) {
    if (now - entry.at > RESYNC_COOLDOWN_MS) recentlySynced.delete(uid);
  }
}

/**
 * Токен доторх claim нь MySQL-тэй зөрж байвал нөхөж бичнэ.
 *
 * ЯАГААД ЭНЭ ХЭЛБЭРЭЭР ВЭ: custom claims нэвтрүүлэхээс ӨМНӨ бүртгэгдсэн бүх
 * хэрэглэгчид claim байхгүй. Тэднийг нэг удаагийн гар ажиллагаагаар нөхөх нь
 * (а) прод баазын хандалт шаардана, (б) мартагдвал чимээгүйхэн бүтэлгүйтнэ.
 * Оронд нь хүн бүр дараагийн API хүсэлтээрээ өөрөө засагдана.
 *
 * `decoded` нь ШАЛГАГДСАН токен — доторх claim-ийг хэрэглэгч зохиож чадахгүй.
 */
export async function backfillClaimsIfStale(
  decoded: { uid: string; role?: unknown; status?: unknown },
  actual: UserClaims
): Promise<void> {
  if (decoded.role === actual.role && decoded.status === actual.status) return;

  const now = Date.now();
  sweep(now);

  const wanted = `${actual.role}/${actual.status}`;
  const last = recentlySynced.get(decoded.uid);

  // Ижил утгыг саяхан бичсэн бол дахин бичихгүй — хэрэглэгчийн токен
  // сэргэхийг хүлээж байна
  if (last && last.value === wanted && now - last.at < RESYNC_COOLDOWN_MS) {
    return;
  }

  recentlySynced.set(decoded.uid, { value: wanted, at: now });
  await syncUserClaims(decoded.uid, actual);
}

export async function syncUserClaims(
  uid: string,
  claims: UserClaims
): Promise<void> {
  const auth = adminAuth();

  // adminAuth() нь service account тохируулаагүй үед зөвхөн `verifyIdToken`-той
  // нөөц объект буцаадаг. Тэр горимд claim бичих боломжгүй — дуугүй алгасна.
  if (typeof (auth as { setCustomUserClaims?: unknown }).setCustomUserClaims !== "function") {
    console.warn(
      `[claims] Firebase Admin тохируулаагүй тул ${uid}-ийн claim бичигдсэнгүй.`
    );
    return;
  }

  try {
    await (
      auth as {
        setCustomUserClaims: (uid: string, claims: object) => Promise<void>;
      }
    ).setCustomUserClaims(uid, { role: claims.role, status: claims.status });
  } catch (error) {
    console.error(`[claims] ${uid}-ийн claim бичихэд алдаа гарлаа:`, error);
  }
}
