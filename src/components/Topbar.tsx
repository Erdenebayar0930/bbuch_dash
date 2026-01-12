"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import MobileSidebar from "@/components/MobileSidebar";

export default function MobileHeader() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="md:hidden flex items-center p-3 border-b">
        <button onClick={() => setOpen(true)}>
          <Menu />
        </button>
        <span className="ml-3 font-semibold">Dashboard</span>
      </header>

      <MobileSidebar open={open} onClose={() => setOpen(false)} />
    </>
  );
}
