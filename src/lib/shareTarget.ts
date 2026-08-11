"use client";

/**
 * Банкны аппаас «Хуваалцах»-аар ирсэн файлыг авах тал.
 *
 * Service worker (`worker/index.js`) нь POST-оор ирсэн файлыг Cache Storage-д
 * хийгээд хуудсыг `?shared=1`-тэй нээдэг. Энд түүнийг гаргаж авна.
 *
 * ⚠ Тогтмолууд нь `worker/index.js`-тэй ЯГ ТААРАХ ёстой — SW нь тусдаа bundle
 * тул хамтад нь import хийж болохгүй.
 */
const SHARE_CACHE = "shared-statement";
const SHARE_KEY = "/__shared-statement";

/** Хуваалцаж ирсэн эсэхийг хаягаар нь мэднэ */
export const SHARED_FLAG = "shared";

/**
 * Кэшэд хүлээж буй файлыг гаргаж авна (аваад устгана).
 *
 * Олдохгүй бол null — хэрэглэгч хуудсыг гараар нээсэн байна.
 */
export async function takeSharedFile(): Promise<File | null> {
  if (typeof caches === "undefined") return null;

  try {
    const cache = await caches.open(SHARE_CACHE);
    const response = await cache.match(SHARE_KEY);
    if (!response) return null;

    const blob = await response.blob();

    // Нэрийг SW нь толгойд хийсэн — Response өөрөө файлын нэр үлдээдэггүй
    const raw = response.headers.get("x-share-filename");
    const name = raw ? decodeURIComponent(raw) : "statement.xlsx";

    await cache.delete(SHARE_KEY);

    return new File([blob], name, {
      type: blob.type || "application/octet-stream",
    });
  } catch (error) {
    console.error("Хуваалцсан файлыг уншиж чадсангүй:", error);
    return null;
  }
}

/**
 * Хаягнаас `?shared=1`-ийг арилгана.
 *
 * Дахин ачаалахад «хуваалцсан файл байна» гэж дэмий хайхгүйн тулд —
 * түүхийг бохирдуулахгүй `replaceState`-ээр.
 */
export function clearSharedFlag() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(SHARED_FLAG)) return;

  url.searchParams.delete(SHARED_FLAG);
  window.history.replaceState(null, "", url.pathname + url.search);
}