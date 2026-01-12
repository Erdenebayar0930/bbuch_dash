"use client";
import ThemeToggle from "./ThemeToggle";

export default function Topbar() {
  return (
    <header className="w-full h-14 bg-white dark:bg-slate-800 border-b dark:border-slate-700 flex items-center justify-between px-4">
      <h1 className="font-bold text-lg text-slate-900 dark:text-white">BBuch Dashboard</h1>
      <ThemeToggle />
    </header>
  );
}
