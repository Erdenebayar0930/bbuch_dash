"use client";

const STORAGE_KEY = "deviceId";

/**
 * Энэ хөтөч дээр тогтмол үлдэх санамсаргүй танигч.
 *
 * `apiClient` хүсэлт бүрт толгойд дамжуулж, сервер тал (`requireActiveUser`)
 * үүгээр тухайн төхөөрөмжийг таньж идэвхтэй эсэхийг шалгана.
 */
let cached: string | null = null;

export function getDeviceId(): string {
  if (cached) return cached;

  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      cached = existing;
      return existing;
    }

    const created = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, created);
    cached = created;
    return created;
  } catch {
    // Хувийн горимд storage хаалттай байж болно — гэсэн ч энэ таб доторх
    // хүсэлт бүрд ижил утга ашиглагдахын тулд санахаа зогсоохгүй
    cached = crypto.randomUUID();
    return cached;
  }
}

/**
 * Дэлгэцийн нягтралыг "1920x1080" хэлбэрээр буцаана — User-Agent толгойд
 * байдаггүй тул сервер тал үүнийг тусад нь толгойгоор авна
 * (`X-Screen-Size`), төхөөрөмжийн нэрийг илүү тодорхой болгоход хэрэглэнэ.
 */
export function getScreenSize(): string | null {
  try {
    if (typeof screen === "undefined") return null;
    return `${screen.width}x${screen.height}`;
  } catch {
    return null;
  }
}
