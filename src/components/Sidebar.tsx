"use client";
import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r dark:border-slate-700 min-h-screen p-4 space-y-4">
      <Link href="/" className="text-slate-900 dark:text-white hover:text-blue-500">Home</Link>
      <Link href="/dashboard" className="text-slate-900 dark:text-white hover:text-blue-500">Dashboard</Link>
      <Link href="/profile" className="text-slate-900 dark:text-white hover:text-blue-500">Profile</Link>
    </aside>
  );
}
