"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { BarChart3, LogOut, Settings } from "lucide-react";

import { useSidebar } from "../context/SidebarContext";
import { useUser } from "@/app/(auth)/UserProvider";
import { auth } from "@/lib/firebase";
import { navItems } from "./navigation";

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useUser();

  // Дэлгэрэнгүй (тексттэй) горимд байгаа эсэх
  const showLabels = isExpanded || isHovered || isMobileOpen;

  // Админы цэсийг зөвхөн админд харуулна
  const visibleNavItems = navItems.filter(
    (item) => !item.adminOnly || user?.role === "admin" || user?.role === "super"
  );

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      logout();
      router.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-50 mt-16 flex h-screen flex-col bg-navy-900 text-white transition-all duration-300 ease-in-out lg:mt-0
        ${showLabels ? "w-[260px]" : "w-[88px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Лого */}
      <div
        className={`flex h-[76px] shrink-0 items-center gap-3 px-5 ${
          showLabels ? "justify-start" : "lg:justify-center lg:px-0"
        }`}
      >
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-600">
            <BarChart3 className="h-5 w-5 text-white" strokeWidth={2.5} />
          </span>
          {showLabels && (
            <span className="flex flex-col leading-none">
              <span className="text-lg font-semibold tracking-tight text-white">
                daamal
              </span>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
                Санхүүгийн систем
              </span>
            </span>
          )}
        </Link>
      </div>

      {/* Үндсэн цэс */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar">
        <ul className="flex flex-col gap-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  title={showLabels ? undefined : item.name}
                  className={`nav-item ${
                    active ? "nav-item-active" : "nav-item-inactive"
                  } ${showLabels ? "" : "lg:justify-center"}`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      active ? "text-white" : "text-white/50"
                    }`}
                    strokeWidth={1.8}
                  />
                  {showLabels && <span className="truncate">{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Доод хэсэг — тохиргоо, гарах */}
      <div className="shrink-0 border-t border-white/10 px-3 py-4">
        <ul className="flex flex-col gap-1">
          <li>
            <Link
              href="/settings"
              title={showLabels ? undefined : "Тохиргоо"}
              className={`nav-item ${
                isActive("/settings") ? "nav-item-active" : "nav-item-inactive"
              } ${showLabels ? "" : "lg:justify-center"}`}
            >
              <Settings className="h-5 w-5 shrink-0" strokeWidth={1.8} />
              {showLabels && <span>Тохиргоо</span>}
            </Link>
          </li>
          <li>
            <button
              onClick={handleLogout}
              title={showLabels ? undefined : "Гарах"}
              className={`nav-item nav-item-inactive ${
                showLabels ? "" : "lg:justify-center"
              }`}
            >
              <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.8} />
              {showLabels && <span>Гарах</span>}
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
};

export default AppSidebar;
