import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

const CACHE_KEY = "user_profile_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

export async function getUserProfile(uid: string) {
  // 🔹 1. Cache шалгах
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem(CACHE_KEY);

    if (cached) {
      const parsed = JSON.parse(cached);

      if (
        parsed.uid === uid &&
        Date.now() - parsed.time < CACHE_TTL
      ) {
        return parsed.data; // ✅ cache
      }
    }
  }

  // 🔹 2. Firestore-оос татах
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data();

  // 🔹 3. Cache хадгалах
  if (typeof window !== "undefined") {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        uid,
        data,
        time: Date.now(),
      })
    );
  }

  return data;
}
