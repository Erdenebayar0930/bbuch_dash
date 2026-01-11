import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const appCache = {}; // ⭐ company бүрт тусдаа app

export function initFirebase(companyKey, config) {
  if (!companyKey || !config) {
    throw new Error("Company key or Firebase config missing");
  }

  if (!appCache[companyKey]) {
    const app = initializeApp(config, companyKey);
    appCache[companyKey] = {
      app,
      auth: getAuth(app),
      db: getFirestore(app),
    };
  }

  return appCache[companyKey];
}
