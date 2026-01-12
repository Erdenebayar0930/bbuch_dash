// components/Sidebar.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center p-3 border-b">
        <button onClick={() => setOpen(true)}>
          <Menu />
        </button>
        <span className="ml-3 font-bold">Dashboard</span>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed z-40 top-0 left-0 h-full w-64 bg-slate-900 text-white
          transform transition-transform
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:static
        `}
      >
        <div className="p-4 font-bold text-lg">My PWA</div>

        <nav className="space-y-2 px-4">
          <Link href="/" className="block p-2 rounded hover:bg-slate-700">Home</Link>
          <Link href="/reports" className="block p-2 rounded hover:bg-slate-700">Reports</Link>
          <Link href="/settings" className="block p-2 rounded hover:bg-slate-700">Settings</Link>
        </nav>

        {/* Mobile close overlay */}
        {open && (
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black/50 md:hidden"
          />
        )}
      </aside>
    </>
  );
}
