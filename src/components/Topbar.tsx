// components/Topbar.tsx
import React from "react";

interface TopbarProps {
  title?: string;
}

export default function Topbar({ title = "Dashboard" }: TopbarProps) {
  return (
    <div className="h-16 bg-white shadow flex items-center justify-between px-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="flex items-center space-x-4">
        <span>Admin</span>
      </div>
    </div>
  );
}
