"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

/** Хэрэглэгчийн сонголт — "system" бол үйлдлийн системийн горимыг дагана */
export type ThemePreference = "light" | "dark" | "system";
/** Эцэст нь хэрэглэгдэх бодит горим */
export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

type ThemeContextType = {
  /** Сонголт: гэрэлтэй / харанхуй / систем */
  preference: ThemePreference;
  /** Сонголтоос гарсан бодит горим */
  theme: Theme;
  setPreference: (preference: ThemePreference) => void;
  /** Толгойн товчинд ашиглагдана — гэрэлтэй ↔ харанхуй */
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Сонголт нь localStorage дотор, өөрөөр хэлбэл React-ийн ГАДНА байдаг төлөв.
// Тиймээс useState биш useSyncExternalStore-оор уншина: SSR үед "system"
// гэсэн серверийн snapshot ашиглагдаж, hydration-ы зөрчилгүйгээр клиент дээр
// бодит утга руу шилжинэ.
// ---------------------------------------------------------------------------

let listeners: Array<() => void> = [];

const subscribePreference = (onChange: () => void) => {
  listeners.push(onChange);

  // Өөр таб дээр солигдвол энэ таб мөн дагана
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners = listeners.filter((listener) => listener !== onChange);
    window.removeEventListener("storage", onStorage);
  };
};

function readPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "light" || raw === "dark" || raw === "system"
      ? raw
      : "system";
  } catch {
    return "system";
  }
}

const subscribeSystem = (onChange: () => void) => {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

const isSystemDark = () => window.matchMedia(DARK_QUERY).matches;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSyncExternalStore(
    subscribePreference,
    readPreference,
    () => "system" as ThemePreference
  );

  const systemDark = useSyncExternalStore(
    subscribeSystem,
    isSystemDark,
    () => false
  );

  const theme: Theme =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Хувийн горимд бичих боломжгүй байж болно — горим нь тухайн сессид ажиллана
    }
    listeners.forEach((listener) => listener());
  }, []);

  // Толгойн товч нь одоо ХАРАГДАЖ буй горимыг эсрэгээр нь эргүүлнэ. "system"
  // байсан бол ингэснээр тодорхой сонголт болж бэхлэгдэнэ.
  const toggleTheme = useCallback(() => {
    setPreference(theme === "dark" ? "light" : "dark");
  }, [setPreference, theme]);

  // DOM-ыг тохируулах нь гадаад системийг шинэчилж буй хэрэг — эффектийн зөв хэрэглээ
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    // Хөтчийн өөрийн элементүүд (scrollbar, select) ч горимоо дагана
    root.style.colorScheme = theme;
  }, [theme]);

  const value = useMemo(
    () => ({ preference, theme, setPreference, toggleTheme }),
    [preference, theme, setPreference, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
