"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, X } from "lucide-react";

import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import UserDropdown from "@/components/header/UserDropdown";
import { useSidebar } from "@/context/SidebarContext";
import { getPageTitle } from "./navigation";

const AppHeader: React.FC = () => {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  return (
    /*
     * Чуулганы вэбсайттай нэг маягийн ягаан тууз. Доод ирмэгийн алтан зурвас
     * нь сүлдний өнгийг давтаж, цагаан агуулгаас тусгаарлана.
     */
    <header className="sticky top-0 z-99999 w-full border-b-2 border-gold-400 bg-brand-800 dark:bg-brand-950">
      <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
        {/* Зүүн тал — цэсний товч ба breadcrumb */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={handleToggle}
            aria-label="Цэс нээх/хаах"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {isMobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>

          {/* Сүлд — lg-ээс доош хажуугийн самбар нуугддаг тул зөвхөн тэнд */}
          <Link href="/" className="shrink-0 lg:hidden" aria-label="Нүүр">
            <Image
              src="/images/logo/logo-mark.png"
              alt="ББУЧ"
              width={72}
              height={72}
              priority
              className="h-9 w-9 object-contain"
            />
          </Link>

          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex items-center gap-1.5 text-sm">
              <li className="hidden sm:block">
                <Link
                  href="/"
                  className="font-semibold uppercase tracking-wide text-gold-300 transition-colors hover:text-gold-200"
                >
                  ББУЧ
                </Link>
              </li>
              <li aria-hidden="true" className="hidden sm:block">
                <ChevronRight className="h-4 w-4 text-white/30" />
              </li>
              <li className="truncate font-medium text-white">{pageTitle}</li>
            </ol>
          </nav>
        </div>

        {/* Баруун тал — горим, мэдэгдэл, хэрэглэгч */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggleButton />
          <NotificationDropdown />
          <UserDropdown />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
