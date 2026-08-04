import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
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

// FCM Token авах
export async function requestNotificationPermission(): Promise<string | null> {
  if (!messaging) {
    console.warn("Messaging is not available");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      });
      if (token) {
        console.log("FCM Token:", token);
        localStorage.setItem("fcmToken", token);
        return token;
      }
    } else {
      console.warn("Notification permission denied");
    }
  } catch (error) {
    console.error("Error getting FCM token:", error);
  }
  return null;
}

// Foreground notification хүлээн авах
export function onMessageListener() {
  return new Promise((resolve) => {
    if (messaging) {
      onMessage(messaging, (payload) => {
        resolve(payload);
      });
    }
  });
}