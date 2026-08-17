"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, ChevronDown, LogOut, Settings } from "lucide-react";

import { useSidebar } from "../context/SidebarContext";
import { useUser } from "@/app/(auth)/UserProvider";
import { signOutCompletely } from "@/lib/session";
import { canSeeNavItem, navItems } from "./navigation";

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, closeMobileSidebar } =
    useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useUser();

  /**
   * Гараар нээсэн/хаасан дэд цэсүүд. Энд байхгүй цэс нь идэвхтэй хуудсаараа
   * автоматаар задарна — тиймээс эхлэлийн утгыг effect-ээр тааруулах шаардлагагүй.
   */
  const [openMenus, setOpenMenus] = React.useState<Record<string, boolean>>({});

  // Дэлгэрэнгүй (тексттэй) горимд байгаа эсэх
  const showLabels = isExpanded || isHovered || isMobileOpen;

  // Админы цэс зөвхөн админд; аймгийн цэс зөвхөн тухайн аймгийн гишүүдэд
  const visibleNavItems = navItems.filter((item) =>
    canSeeNavItem(item, { role: user?.role, aimags: user?.aimags })
  );

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  const handleLogout = async () => {
    closeMobileSidebar();
    await signOutCompletely();
    logout();
    router.replace("/login");
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
        {/* Шилжих бүрд цэсийг хаана — утсан дээр цэс агуулгыг бүтэн халхалдаг */}
        <Link href="/" onClick={closeMobileSidebar} className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-600">
            <BarChart3 className="h-5 w-5 text-white" strokeWidth={2.5} />
          </span>
          {showLabels && (
            <span className="flex flex-col leading-none">
              <span className="text-lg font-semibold tracking-tight text-white">
                Бид туслая
              </span>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
                Dashboard
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

            // Дэд цэстэй мөр — задардаг бүлэг
            if (item.children?.length) {
              // Хүүхэд бүр өөрийн хязгаарлалттай байж болно (жишээ нь Дансны
              // хуулга нь зөвхөн админд) — эцгийг нь харж болох нь хүүхдийг
              // нь харж болно гэсэн үг биш
              const children = item.children.filter((child) =>
                canSeeNavItem(
                  { ...child, aimag: child.aimag ?? item.aimag },
                  { role: user?.role, aimags: user?.aimags }
                )
              );

              // Бүх хүүхэд нь нуугдвал хоосон бүлэг үлдэх учир мөрийг алгасна
              if (children.length === 0) return null;

              // Хумигдсан горимд задлах зай байхгүй тул эхний хүүхэд рүү шууд
              const collapsedHref = children[0].path;
              // Хүүхэд нь эцгийнхээ замын доор байх албагүй (Газрын зураг →
              // /map) тул идэвхтэй эсэхийг хүүхдүүдээр нь ч шалгана
              const groupActive =
                active || children.some((child) => isActive(child.path));
              const open = openMenus[item.path] ?? groupActive;

              return (
                <li key={item.path}>
                  {showLabels ? (
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() =>
                        setOpenMenus((prev) => ({
                          ...prev,
                          [item.path]: !open,
                        }))
                      }
                      className={`nav-item w-full ${
                        groupActive ? "nav-item-active" : "nav-item-inactive"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 shrink-0 ${
                          groupActive ? "text-white" : "text-white/50"
                        }`}
                        strokeWidth={1.8}
                      />
                      <span className="truncate">{item.name}</span>
                      <ChevronDown
                        className={`ml-auto h-4 w-4 shrink-0 text-white/40 transition-transform ${
                          open ? "rotate-180" : ""
                        }`}
                        strokeWidth={2}
                      />
                    </button>
                  ) : (
                    <Link
                      href={collapsedHref}
                      onClick={closeMobileSidebar}
                      title={item.name}
                      className={`nav-item lg:justify-center ${
                        groupActive ? "nav-item-active" : "nav-item-inactive"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 shrink-0 ${
                          groupActive ? "text-white" : "text-white/50"
                        }`}
                        strokeWidth={1.8}
                      />
                    </Link>
                  )}

                  {showLabels && open && (
                    <ul className="mt-1 flex flex-col gap-1 border-l border-white/10 pl-3 ml-5">
                      {children.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = isActive(child.path);

                        return (
                          <li key={child.path}>
                            <Link
                              href={child.path}
                              className={`nav-item ${
                                childActive
                                  ? "nav-item-active"
                                  : "nav-item-inactive"
                              }`}
                            >
                              <ChildIcon
                                className={`h-4.5 w-4.5 shrink-0 ${
                                  childActive ? "text-white" : "text-white/50"
                                }`}
                                strokeWidth={1.8}
                              />
                              <span className="truncate">{child.name}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            }

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
