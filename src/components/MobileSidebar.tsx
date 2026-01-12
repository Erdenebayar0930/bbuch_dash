"use client";

import Link from "next/link";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function MobileSidebar({ open, onClose }: Props) {
  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 text-white
          transform transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:hidden
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <span className="text-lg font-bold">Menu</span>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex flex-col gap-1 p-4">
          <Link
            href="/"
            onClick={onClose}
            className="rounded px-3 py-2 hover:bg-slate-700"
          >
            Dashboard
          </Link>

          <Link
            href="/reports"
            onClick={onClose}
            className="rounded px-3 py-2 hover:bg-slate-700"
          >
            Reports
          </Link>

          <Link
            href="/settings"
            onClick={onClose}
            className="rounded px-3 py-2 hover:bg-slate-700"
          >
            Settings
          </Link>
        </nav>
      </aside>
    </>
  );
}
