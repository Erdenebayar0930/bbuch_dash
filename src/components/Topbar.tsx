"use client";

import { useState, useEffect, useRef } from "react";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import { getUserProfile } from "@/lib/getUserProfile";

import {
  Bell,
  Moon,
  Sun,
  ChevronDown,
  LogOut,
  User as UserIcon,
} from "lucide-react";

import { firebaseApp } from "@/lib/firebase"; // 🔴 заавал

interface UserProfile {
  name: string;
  role: string;
  photoURL?: string;
}
const auth = getAuth(firebaseApp);

/* 👉 Нэрийн эхний 2 үсэг */
const getInitials = (name?: string | null): string => {
  if (!name) return "??";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export default function Topbar() {
  const [dark, setDark] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const userRef = useRef<HTMLDivElement>(null);
  const notifyRef = useRef<HTMLDivElement>(null);

  /* 👉 Firebase auth listener */
  useEffect(() => {
     const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProfile(null);
        return;
      }

      const data = await getUserProfile(user.uid);
      setProfile(data as UserProfile);
    });

    return unsub;
  }, []);

  /* 👉 Dark mode (client only) */
  useEffect(() => {
    const saved = localStorage.getItem("dark");
    if (saved === "true") {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleDark = () => {
    setDark((prev) => {
      const next = !prev;
      localStorage.setItem("dark", String(next));
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  };

  /* 👉 Outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
      if (
        notifyRef.current &&
        !notifyRef.current.contains(e.target as Node)
      ) {
        setNotifyOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="flex items-center p-4
      bg-gray-50 dark:bg-gray-900
      border-b border-gray-200 dark:border-gray-700
      shadow-sm sticky top-0 z-50">

      <div className="font-semibold">ББУЧ</div>

      <div className="ml-auto flex items-center gap-4">

        {/* Dark mode */}
        <button
          onClick={toggleDark}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifyRef}>
          <button
            onClick={() => setNotifyOpen((v) => !v)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Bell size={18} />
          </button>

          {notifyOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border rounded-lg p-3 text-sm shadow-lg">
              <p className="font-semibold mb-2">Notifications</p>
              <div>🔔 New order received</div>
              <div className="mt-1">🔔 Report ready</div>
            </div>
          )}
        </div>

        {/* User */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserOpen((v) => !v)}
            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
              {getInitials(profile?.name)}
            </div>
            <ChevronDown size={14} />
          </button>

          {userOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border rounded-lg shadow-lg text-sm">
              <div className="px-4 py-2 text-xs text-gray-500">
                {user?.email}
              </div>

              <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full">
                <UserIcon size={16} /> Профайл
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 w-full"
              >
                <LogOut size={16} /> Программаас гарах
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
