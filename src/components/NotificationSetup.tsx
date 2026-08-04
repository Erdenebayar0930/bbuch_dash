"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { saveCurrentUserFCMToken } from "@/lib/fcm";

/**
 * Мэдэгдлийн суурь тохируулга — layout дээр нэг удаа ажиллана.
 *
 * Зөвшөөрлийг ЭНД гуйхгүй. Хөтчүүд хэрэглэгчийн үйлдэлгүй (user gesture)
 * дуудсан Notification.requestPermission()-ыг ихэвчлэн үл тоомсорлодог, бүр
 * "хаасан" гэж тэмдэглэдэг. Тиймээс зөвшөөрлийг Тохиргоо → Мэдэгдэл хэсгийн
 * товчоор гуйна. Энд зөвхөн аль хэдийн зөвшөөрсөн бол token-оо сэргээнэ.
 */
export default function NotificationSetup() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Service worker-ээс ирэх мэдэгдэл дээр дарсан эвентийг сонсоно.
    // firebase-messaging-sw.js-ийг ӨӨРСДӨӨ бүртгэхгүй — FCM SDK түүнийг
    // /firebase-cloud-messaging-push-scope хэмээх өөрийн scope дээр бүртгэдэг.
    // Гараар scope "/" дээр бүртгэвэл next-pwa-гийн /sw.js-тэй мөргөлдөж,
    // хожим бүртгэгдсэн нь нөгөөгөө сольдог.
    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== "NOTIFICATION_CLICK") return;

      const { url } = event.data as { url?: string };

      window.dispatchEvent(
        new CustomEvent("notificationClick", { detail: event.data })
      );

      if (!url || url === "/") return;

      if (url.startsWith("http")) {
        window.open(url, "_blank");
        return;
      }

      try {
        router.push(url);
      } catch (error) {
        console.error("Navigation error:", error);
        window.location.href = url;
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onServiceWorkerMessage);
    }

    // Зөвшөөрөл өмнө нь өгсөн бол token-ыг сэргээж серверт үлдээнэ.
    // Token нь төхөөрөмж/хөтөч солигдоход шинэчлэгддэг тул нэвтрэх бүрд шалгана.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      if (!("Notification" in window) || Notification.permission !== "granted") {
        return;
      }

      saveCurrentUserFCMToken().catch((error) => {
        console.error("FCM token сэргээхэд алдаа гарлаа:", error);
      });
    });

    return () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "message",
          onServiceWorkerMessage
        );
      }
      unsubscribe();
    };
  }, [router]);

  return null;
}
