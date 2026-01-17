"use client";

import { createContext, useContext, useState, useEffect } from "react";

type UserType = {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
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
  const setUser = (u: UserType) => {
    setUserState(u);
    sessionStorage.setItem("user", JSON.stringify(u));
  };

  // 🔹 logout
  const logout = () => {
    setUserState(null);
    sessionStorage.removeItem("user");
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within UserProvider");
  return context;
}
