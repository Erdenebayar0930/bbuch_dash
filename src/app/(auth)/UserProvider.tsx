"use client";

import { auth } from "@/lib/firebase";
import { signOut } from "@firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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
};

type UserContextType = {
  user: UserType | null;
  setUser: (user: UserType) => void;
  logout: () => void;
};

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<UserType | null>(null);

  // 🔹 SessionStorage-аас user сэргээх
  useEffect(() => {
    const cached = sessionStorage.getItem("user");
    if (cached) {
      setUserState(JSON.parse(cached));
    }
  }, []);

  // 🔹 setUser дээр cache хийж хадгалах
  // useCallback заавал — AdminGuard эдгээрийг effect-ийн хамаарал болгон
  // ашигладаг тул рендер бүрт шинэ функц үүсвэл шалгалт төгсгөлгүй давтагдана.
  const setUser = useCallback((u: UserType) => {
    setUserState(u);
    sessionStorage.setItem("user", JSON.stringify(u));
  }, []);

  // 🔹 logout
  const logout = useCallback(() => {
    signOut(auth);
    setUserState(null);
    sessionStorage.removeItem("user");
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
