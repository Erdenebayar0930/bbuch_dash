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
     * Энгийн цагаан дэвсгэр, premium загвар — нимгэн доод хүрээ ба зөөлөн
     * сүүдэр л дүрсийг бодит цаас/шилээс тусгаарлана, өмнөх зузаан алтан
     * зурвасны оронд.
     */
    <header className="sticky top-0 z-99999 w-full border-b border-gray-200 bg-white shadow-theme-xs dark:border-white/10 dark:bg-gray-900">
      <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
        {/* Зүүн тал — цэсний товч ба breadcrumb */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={handleToggle}
            aria-label="Цэс нээх/хаах"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
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
                  className="font-semibold uppercase tracking-wide text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  ББУЧ
                </Link>
              </li>
              <li aria-hidden="true" className="hidden sm:block">
                <ChevronRight className="h-4 w-4 text-gray-300 dark:text-white/20" />
              </li>
              <li className="truncate font-medium text-gray-800 dark:text-white">
                {pageTitle}
              </li>
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
