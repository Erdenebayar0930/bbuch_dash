"use client";
import Link from "next/link";

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 w-full bg-white dark:bg-slate-800 border-t dark:border-slate-700 flex justify-around p-2 text-gray-800 dark:text-gray-200">
      <Link href="/">Home</Link>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/profile">Profile</Link>
    </nav>
  );
}
