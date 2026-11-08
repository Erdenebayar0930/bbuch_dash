"use client";

import { useEffect } from "react";

/**
 * next-pwa-гийн үүсгэсэн /sw.js-ийг бүртгэнэ.
 *
 * ЯАГААД ГАРААР? next-pwa@5 нь `register: true` үед бүртгэлийн кодоо webpack-ийн
 * `main.js` entry-д шургуулдаг. Гэтэл App Router нь `main.js`-ийг ОГТ ачаалдаггүй
 * — түүний оронд `main-app.js` ачаалдаг. Улмаас sw.js нь build бүрт үүсэж
 * байсан ч хөтөч дээр хэзээ ч бүртгэгдэхгүй, PWA "суух" санал гарахгүй байсан.
 * Тиймээс next.config.ts дотор `register: false` болгож, бүртгэлийг энд хийв.
 *
 * firebase-messaging-sw.js-ийг ЭНД бүртгэхгүй — түүнийг FCM SDK нь
 * /firebase-cloud-messaging-push-scope хэмээх өөрийн scope дээр бүртгэдэг
 * (@see NotificationSetup).
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    // Хөгжүүлэлтийн үед next-pwa нь sw.js гаргадаггүй (disable: true) тул
    // бүртгэх гэж оролдвол 404 дээр алдаа хаяна.
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;
    const loadedAt = Date.now();

    /**
     * Шинэ deploy-ийн SW (skipWaiting + clientsClaim) хяналтаа авахад хуудсыг
     * НЭГ удаа дахин ачаална. Үгүй бол энэ хуудас хуучин SW-ийн дүрмээр
     * ачаалагдсан хэвээр үлдэнэ — жишээ нь хуучин SW-ийн CSP газрын зургийн
     * хавтанг хааж байсан тул утсан дээр зураг саарал хоосон харагдаж, хэрэглэгч
     * аппаа гараар хааж нээх хэрэгтэй болдог байсан.
     *
     * Анх суулгахад (өмнө нь controller байгаагүй) дахин ачаалахгүй. Мөн
     * хэрэглэгч аль хэдийн маягт бөглөж эхэлсэн байж болох тул зөвхөн хуудас
     * нээгдээд удаагүй байхад л ачаална — бусад үед дараагийн шилжилт шинэ SW
     * дээр явна.
     */
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    const onControllerChange = () => {
      if (!hadController || reloaded) return;
      if (Date.now() - loadedAt > 20_000) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // PWA-г арын фоноос сэргээхэд навигаци болдоггүй тул шинэчлэлтийг гараар шалгана.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => {}));
    };
    document.addEventListener("visibilitychange", onVisible);

    // Хуудасны эхний ачаалалттай өрсөлдөхгүйн тулд load хүлээнэ.
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          if (cancelled) return;
          // Хэрэглэгч аппыг удаан нээлттэй барьдаг тул шинэчлэлтийг үе үе шалгана.
          registration.update().catch(() => {});
        })
        .catch((error) => {
          console.error("[PWA] Service worker бүртгэх үед алдаа:", error);
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
