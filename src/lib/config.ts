export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  vapidKey?: string;
}

export interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

const fallbackFirebaseClientConfig: FirebaseClientConfig = {
  apiKey: "AIzaSyB9fXul1pKxb_IJ2nqvlfeIP3qtXT7jYLg",
  authDomain: "bbuch-edba7.firebaseapp.com",
  projectId: "bbuch-edba7",
};

export function getFirebaseClientConfig(): FirebaseClientConfig {
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || fallbackFirebaseClientConfig.projectId;

  return {
    ...fallbackFirebaseClientConfig,
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || fallbackFirebaseClientConfig.apiKey,
    authDomain:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || fallbackFirebaseClientConfig.authDomain,
    projectId,
    // Bucket заагаагүй бол шинэ төслүүдийн үндсэн нэр рүү унана — хоосон
    // үлдээвэл getStorage() алдаа өгнө.
    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "",
  };
}

export function getFirebaseAdminConfig(): FirebaseAdminConfig {
  return {
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") || "",
  };
}

export function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
