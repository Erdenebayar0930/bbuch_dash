"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Moon, Sun, User } from "lucide-react";

export default function Topbar() {
  const router = useRouter();
  const [dark, setDark] = useState(false);

  const logout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const toggleTheme = () => {
    setDark(!dark);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b flex items-center justify-between px-6">
      {/* LEFT */}
      <div className="font-semibold text-lg">
        Dashboard
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-4">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* User menu */}
        <div className="relative group">
          <button className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <User size={18} />
            <span className="hidden md:block text-sm">Admin</span>
          </button>

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border rounded shadow hidden group-hover:block">
            <button
              onClick={logout}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
