import "server-only";

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";

import { getFirebaseAdminConfig } from "./config";

type FirebaseLookupUser = {
  localId?: string;
  email?: string | null;
  displayName?: string | null;
};

type FirebaseLookupResponse = {
  users?: FirebaseLookupUser[];
};

type DecodedFirebaseToken = {
  uid: string;
  email?: string | null;
};

/**
 * Сервер талын Firebase Admin SDK.
 *
 * Аутентикацийн ID token шалгах болон FCM илгээхэд ашиглана. Апп-ын өгөгдөл
 * Postgres-д байгаа тул Firestore энд ашиглагдахгүй.
 *
 * Service account түлхүүр нь ЗӨВХӨН сервер талд байх ёстой — эдгээр хувьсагчид
 * NEXT_PUBLIC_ угтваргүй тул browser bundle-д хэзээ ч орохгүй.
 *
 * .env.local (болон Vercel → Settings → Environment Variables):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 */
function hasFirebaseAdminConfig() {
  const { projectId, clientEmail, privateKey } = getFirebaseAdminConfig();

  return Boolean(
    projectId &&
      clientEmail &&
      privateKey &&
      !privateKey.includes("YOUR_PRIVATE_KEY_HERE")
  );
}

function initAdmin() {
  if (getApps().length > 0) {
    return getApp();
  }

  if (!hasFirebaseAdminConfig()) {
    return null;
  }

  const { projectId, clientEmail, privateKey } = getFirebaseAdminConfig();

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function extractFirebaseUserFromLookupResponse(
  payload: FirebaseLookupResponse
): DecodedFirebaseToken {
  const [firstUser] = payload.users ?? [];

  return {
    uid: firstUser?.localId ?? "",
    email: firstUser?.email ?? null,
  };
}

async function verifyIdTokenWithPublicApi(idToken: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY тохируулагдаагүй байна.");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );

  const payload = (await response.json().catch(() => ({}))) as FirebaseLookupResponse & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Firebase ID token шалгалт амжилтгүй боллоо.");
  }

  return extractFirebaseUserFromLookupResponse(payload);
}

export const adminAuth = () => {
  const adminApp = initAdmin();

  if (adminApp) {
    return getAuth(adminApp);
  }

  return {
    verifyIdToken: async (idToken: string) => verifyIdTokenWithPublicApi(idToken),
  };
};

export const adminMessaging = () => {
  const adminApp = initAdmin();

  if (!adminApp) {
    throw new Error(
      "Firebase Admin тохиргоо дутуу байна. FCM илгээхийн тулд бодит service account key-ийг тохируулна уу."
    );
  }

  return getMessaging(adminApp);
};
