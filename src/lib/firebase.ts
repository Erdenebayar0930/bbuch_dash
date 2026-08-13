import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getMessaging } from "firebase/messaging";
import { getStorage } from "firebase/storage";

import { getFirebaseClientConfig } from "./config";

const firebaseConfig = getFirebaseClientConfig();

const app = initializeApp(firebaseConfig);

export { app };

export const auth = getAuth(app);

/** Профайлын зураг зэрэг файл хадгалах Cloud Storage bucket */
export const storage = getStorage(app);

// Мэдэгдэл илгээх нь /api/notifications/send route дээр ажиллана —
// Cloud Functions ашиглахаа больсон.

// Firebase Cloud Messaging
let messaging: ReturnType<typeof getMessaging> | null = null;

if (typeof window !== "undefined") {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.warn("Firebase Messaging initialization failed:", error);
  }
}

export { messaging };

// Token авах болон foreground мэдэгдэл сонсох нь `lib/notifications.ts` дотор.
// Энэ файл нь зөвхөн Firebase-ийн үйлчилгээнүүдийг эхлүүлнэ.