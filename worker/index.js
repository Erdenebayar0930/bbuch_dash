/**
 * next-pwa-ийн үүсгэсэн service worker-т нэмэгддэг өөрийн код.
 *
 * ЗОРИУЛАЛТ: банкны аппаас «Хуваалцах» дарж дансны хуулгыг шууд энэ апп руу
 * илгээх (Web Share Target).
 *
 * Яагаад service worker хэрэгтэй вэ: share target нь файлыг POST-оор
 * ЗАМ РУУ (/statement) илгээдэг, харин Next.js-ийн хуудас POST хүлээж авдаггүй.
 * Тиймээс SW нь тэр POST-ыг барьж аваад, файлыг Cache Storage-д түр хийж,
 * хуудсыг GET-ээр нээнэ. Хуудас нь ачаалахдаа файлыг кэшээс авна.
 *
 * Файл сервер рүү ЭНД илгээгдэхгүй — хэрэглэгч хуудсан дээр баталгаажуулсны
 * дараа л, нэвтэрсэн сессээрээ илгээнэ.
 *
 * ⚠ Доорх хоёр тогтмол нь `src/lib/shareTarget.ts`-тэй ЯГ ТААРАХ ёстой.
 * Service worker тусдаа bundle тул тэндээс import хийж чадахгүй.
 */
const SHARE_CACHE = "shared-statement";
const SHARE_KEY = "/__shared-statement";

/** Share target аль зам руу POST хийхийг manifest.json дээр заасан */
const SHARE_PATH = "/statement";

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "POST") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname !== SHARE_PATH) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const form = await request.formData();
        const file = form.get("file");

        if (file && typeof file !== "string") {
          const cache = await caches.open(SHARE_CACHE);

          // Нэрийг толгойд хадгална — Response нь файлын нэрийг үлдээдэггүй
          await cache.put(
            SHARE_KEY,
            new Response(file, {
              headers: {
                "content-type": file.type || "application/octet-stream",
                "x-share-filename": encodeURIComponent(
                  file.name || "statement.xlsx"
                ),
              },
            })
          );
        }
      } catch (error) {
        // Файлыг барьж чадаагүй ч хуудсыг нээнэ — хэрэглэгч гараар сонгож болно
        console.error("Хуваалцсан файлыг хадгалж чадсангүй:", error);
      }

      // 303 — POST-ыг GET болгон хөрвүүлнэ, эс бөгөөс дахин POST давтагдана
      return Response.redirect(`${SHARE_PATH}?shared=1`, 303);
    })()
  );
});
