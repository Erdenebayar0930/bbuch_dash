"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings } from "lucide-react";

import { useSidebar } from "../context/SidebarContext";
import { useUser } from "@/app/(auth)/UserProvider";
import { signOutCompletely } from "@/lib/session";
import { canSeeNavItem, navItems, type NavItem, type NavViewer } from "./navigation";

/** Хумигдсан горимд бүлэг дарахад орох хамгийн эхний хуудас — хэдэн үедээ ч байсан. */
function firstLeafPath(item: NavItem): string {
  return item.children?.length ? firstLeafPath(item.children[0]) : item.path;
}

type NavNodeProps = {
  item: NavItem;
  depth: number;
  viewer: NavViewer;
  isActive: (path: string) => boolean;
  showLabels: boolean;
  openMenus: Record<string, boolean>;
  setOpenMenus: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  closeMobileSidebar: () => void;
};

/** Хэдэн ч түвшинд задардаг цэсийн мөр — өөрөөрөө рекурсив дуудагдана. */
function NavNode({
  item,
  depth,
  viewer,
  isActive,
  showLabels,
  openMenus,
  setOpenMenus,
  closeMobileSidebar,
}: NavNodeProps) {
  const Icon = item.icon;
  const active = isActive(item.path);

  if (!item.children?.length) {
    return (
      <li>
        <Link
          href={item.path}
          onClick={closeMobileSidebar}
          title={showLabels ? undefined : item.name}
          className={`nav-item ${
            active ? "nav-item-active" : "nav-item-inactive"
          } ${showLabels ? "" : "lg:justify-center"}`}
        >
          <Icon
            className={`h-5 w-5 shrink-0 ${
              active ? "text-white" : "text-white/60"
            }`}
            strokeWidth={1.8}
          />
          {showLabels && <span className="truncate">{item.name}</span>}
        </Link>
      </li>
    );
  }

  // Хүүхэд бүр өөрийн хязгаарлалттай байж болно (жишээ нь Дансны хуулга нь
  // зөвхөн админд) — эцгийг нь харж болох нь хүүхдийг нь харж болно гэсэн
  // үг биш
  const children = item.children.filter((child) =>
    canSeeNavItem({ ...child, aimag: child.aimag ?? item.aimag }, viewer)
  );

  // Бүх хүүхэд нь нуугдвал хоосон бүлэг үлдэх учир мөрийг алгасна
  if (children.length === 0) return null;

  // Хумигдсан горимд задлах зай байхгүй тул хамгийн эхний хуудас рүү шууд
  const collapsedHref = firstLeafPath(children[0]);
  // Хүүхэд нь эцгийнхээ замын доор байх албагүй (Газрын зураг → /map) тул
  // идэвхтэй эсэхийг хүүхдүүдээр нь (хэдэн үедээ ч) шалгана
  const groupActive =
    active || children.some((child) => isActive(child.path));
  const open = openMenus[item.path] ?? groupActive;

  return (
    <li>
      {showLabels ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() =>
            setOpenMenus((prev) => ({ ...prev, [item.path]: !open }))
          }
          className={`nav-item w-full ${
            groupActive ? "nav-item-active" : "nav-item-inactive"
          }`}
        >
          <Icon
            className={`h-5 w-5 shrink-0 ${
              groupActive ? "text-white" : "text-white/60"
            }`}
            strokeWidth={1.8}
          />
          <span className="truncate">{item.name}</span>
          <ChevronDown
            className={`ml-auto h-4 w-4 shrink-0 text-white/50 transition-transform ${
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
              groupActive ? "text-white" : "text-white/60"
            }`}
            strokeWidth={1.8}
          />
        </Link>
      )}

      {showLabels && open && (
        <ul
          className="mt-1 flex flex-col gap-1 border-l border-white/15 pl-3 ml-5"
          style={depth > 0 ? { marginLeft: 20 } : undefined}
        >
          {children.map((child) => (
            <NavNode
              key={child.path}
              item={child}
              depth={depth + 1}
              viewer={viewer}
              isActive={isActive}
              showLabels={showLabels}
              openMenus={openMenus}
              setOpenMenus={setOpenMenus}
              closeMobileSidebar={closeMobileSidebar}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

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

  const viewer = {
    role: user?.role,
    aimags: user?.aimags,
    canNotify: user?.can_notify,
  };

  // Админы цэс зөвхөн админд; аймгийн цэс зөвхөн тухайн аймгийн гишүүдэд
  const visibleNavItems = navItems.filter((item) => canSeeNavItem(item, viewer));

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
      className={`fixed left-0 top-0 z-50 mt-16 flex h-screen flex-col bg-gradient-to-b from-brand-700 via-brand-800 to-brand-950 text-white transition-all duration-300 ease-in-out lg:mt-0
        ${showLabels ? "w-[260px]" : "w-[88px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Лого */}
      <div
        className={`flex h-[76px] shrink-0 items-center gap-3 border-b border-white/10 px-5 ${
          showLabels ? "justify-start" : "lg:justify-center lg:px-0"
        }`}
      >
        {/* Шилжих бүрд цэсийг хаана — утсан дээр цэс агуулгыг бүтэн халхалдаг */}
        <Link href="/" onClick={closeMobileSidebar} className="flex items-center gap-3">
          {/* Ягаан дэвсгэр дээр логог тодруулах цагаан бадж */}
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-theme-sm">
            <Image
              src="/images/logo/logo-mark.png"
              alt="ББУЧ"
              width={80}
              height={80}
              priority
              className="h-8 w-8 shrink-0 object-contain"
            />
          </span>
          {showLabels && (
            <span className="flex flex-col leading-none">
              <span className="text-lg font-semibold tracking-tight text-white">
                ББУЧ
              </span>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-gold-300/80">
                Чуулганы удирдлага
              </span>
            </span>
          )}
        </Link>
      </div>

      {/* Үндсэн цэс */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar">
        <ul className="flex flex-col gap-1">
          {visibleNavItems.map((item) => (
            <NavNode
              key={item.path}
              item={item}
              depth={0}
              viewer={viewer}
              isActive={isActive}
              showLabels={showLabels}
              openMenus={openMenus}
              setOpenMenus={setOpenMenus}
              closeMobileSidebar={closeMobileSidebar}
            />
          ))}
        </ul>
      </nav>

      {/* Доод хэсэг — тохиргоо, гарах */}
      <div className="shrink-0 border-t border-white/10 px-3 py-4">
        <ul className="flex flex-col gap-1">
          <li>
            <Link
              href="/settings"
              onClick={closeMobileSidebar}
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
