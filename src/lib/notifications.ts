"use client";

import { requestNotificationPermission, onMessageListener } from "./firebase";
import { messaging } from "./firebase";

export interface NotificationPayload {
  notification?: {
    title?: string;
    body?: string;
    icon?: string;
  };
  data?: {
    url?: string;
    tag?: string;
    [key: string]: string | undefined;
  };
}

// Notification permission шалгах
export function isNotificationPermissionGranted(): boolean {
  if (typeof window === "undefined") return false;
  return Notification.permission === "granted";
}

// Notification permission авах
export async function requestPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  
  if (Notification.permission === "granted") {
    await requestNotificationPermission();
    return true;
  }
  
  if (Notification.permission === "default") {
    const token = await requestNotificationPermission();
    return token !== null;
  }
  
  return false;
}

// Foreground notification хүлээн авах
export function setupForegroundNotifications(
  callback: (payload: NotificationPayload) => void
) {
  if (typeof window === "undefined" || !messaging) return;

  onMessageListener()
    .then((payload: any) => {
      callback(payload);
      
      // Browser notification харуулах
      if (Notification.permission === "granted" && payload.notification) {
        new Notification(payload.notification.title || "Шинэ мэдэгдэл", {
          body: payload.notification.body,
          icon: payload.notification.icon || "/icons/icon-192x192.png",
          badge: "/icons/icon-192x192.png",
          tag: payload.data?.tag || "notification",
          data: payload.data || {},
        });
      }
    })
    .catch((err) => {
      console.error("Error receiving foreground notification:", err);
    });
}

// FCM Token авах
export async function getFCMToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  
  const storedToken = localStorage.getItem("fcmToken");
  if (storedToken) {
    return storedToken;
  }
  
  if (Notification.permission === "granted") {
    const token = await requestNotificationPermission();
    // Token авахдаа сервер лүү хадгална
    if (token) {
      const { saveCurrentUserFCMToken } = await import("./fcm");
      await saveCurrentUserFCMToken();
    }
    return token;
  }
  
  return null;
}
