"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  // INIT – ганц удаа
  useEffect(() => {
    let initialTheme: "light" | "dark" = "light";

    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") {
      initialTheme = saved;
    } else {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      initialTheme = systemDark ? "dark" : "light";
      localStorage.setItem("theme", initialTheme); // 🔥 заавал бич
    }

    document.documentElement.classList.toggle("dark", initialTheme === "dark");
    setTheme(initialTheme);
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // TOGGLE – system-тэй холбоогүй
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
    setTheme(next);
  };

  return (
    <button
      onClick={toggle}
      className="px-3 py-1 border rounded text-sm
        hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      {theme === "dark" ? "☀ Light" : "🌙 Dark"}
    </button>
  );
}
