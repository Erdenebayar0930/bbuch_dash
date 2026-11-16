/**
 * Хадгалсан файлын URL зөв эх сурвалжаас ирсэн эсэх.
 *
 * Шинэ файлууд өөрийн сервер дээр (`/uploads/...`, @see lib/api/fileStore.ts),
 * хуучнууд нь Firebase Storage-д үлдсэн тул хоёуланг нь зөвшөөрнө. Дурын гадны
 * URL-ыг бүртгэлд шигтгэхээс сэргийлнэ.
 */

const FIREBASE_HOSTS = new Set(["firebasestorage.googleapis.com", "storage.googleapis.com"]);

/** Сервер дээрх файлын URL-ын угтвар */
export const UPLOADS_PREFIX = "/uploads/";

/** `/uploads/posts/<uid>/<uuid>.jpg` — зам нь зөвхөн аюулгүй тэмдэгттэй */
const LOCAL_URL = /^\/uploads\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/[A-Za-z0-9_-]+\.[a-z0-9]{1,5}$/;

export function isStoredFileUrl(value: string): boolean {
  if (value.startsWith("/")) return LOCAL_URL.test(value);
  try {
    const url = new URL(value);
    return url.protocol === "https:" && FIREBASE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** Сервер дээрх файл мөн эсэх (Firebase-ийнх биш) */
export const isLocalFileUrl = (value: string) => value.startsWith(UPLOADS_PREFIX);
