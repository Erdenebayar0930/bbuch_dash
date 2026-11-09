"use client";

import { auth } from "@/lib/firebase";
import { signOut } from "@firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

type UserType = {
  uid?: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  /** active | pending | blocked */
  status?: string;
  photoURL?: string;
  /**
   * Харьяалагдах аймгуудын түлхүүр. Цэсийг аймгаар шүүхэд ашиглана —
   * хуучин сессийн кэшэд байхгүй байж болох тул заавал биш.
   */
  aimags?: string[];
  /** Админ бус ч мэдэгдэл илгээх эрх авсан эсэх */
  can_notify?: boolean;
};

type UserContextType = {
  user: UserType | null;
  setUser: (user: UserType) => void;
  logout: () => void;
};

const UserContext = createContext<UserContextType | null>(null);

const STORAGE_KEY = "user";

// 🔹 SessionStorage бол React-ийн гаднах store тул useSyncExternalStore-оор
// уншина. Ингэснээр effect дотор setState дуудахгүй, SSR/hydration зөрөхгүй.
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedUser: UserType | null = null;

function readCachedUser(): UserType | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  // getSnapshot нь тогтвортой утга буцаах ёстой тул parse-ийг memo-лно.
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedUser = raw ? (JSON.parse(raw) as UserType) : null;
    } catch {
      cachedUser = null;
    }
  }
  return cachedUser;
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function writeCachedUser(u: UserType | null) {
  if (u) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  else sessionStorage.removeItem(STORAGE_KEY);
  listeners.forEach((l) => l());
}

/**
 * Хуучин "хурууны хээгээр нэвтрэх" нь нууц үгийг localStorage-д энгийн
 * текстээр хадгалдаг байсан. Функц нь авагдсан — төхөөрөмж дээр үлдсэнийг
 * апп нээгдэх бүрт цэвэрлэнэ (нэвтэрсэн хүн нэвтрэх хуудас руу ордоггүй
 * тул энд, бүх хуудсанд ажилладаг газар байрлана).
 */
const LEGACY_KEYS = [
  "fingerprintPassword",
  "fingerprintEmail",
  "fingerprintRegistered",
  "localPasskey",
  "localLoggedIn",
];

export function UserProvider({ children }: { children: React.ReactNode }) {
  const user = useSyncExternalStore(subscribe, readCachedUser, () => null);

  useEffect(() => {
    try {
      LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Хувийн горимд storage хаалттай байж болно — алгасна
    }
  }, []);

  // 🔹 setUser дээр cache хийж хадгалах
  // useCallback заавал — AdminGuard эдгээрийг effect-ийн хамаарал болгон
  // ашигладаг тул рендер бүрт шинэ функц үүсвэл шалгалт төгсгөлгүй давтагдана.
  const setUser = useCallback((u: UserType) => {
    writeCachedUser(u);
  }, []);

  // 🔹 logout
  const logout = useCallback(() => {
    signOut(auth);
    writeCachedUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, logout }),
    [user, setUser, logout]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within UserProvider");
  return context;
}
