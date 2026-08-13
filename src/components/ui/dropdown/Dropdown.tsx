"use client";
import type React from "react";
import { useEffect, useRef } from "react";

interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  isOpen,
  onClose,
  children,
  className = "",
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node) &&
      !(event.target as HTMLElement).closest('.dropdown-toggle')
    ) {
      onClose();
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [onClose]);


  if (!isOpen) return null;

  return (
    /**
     * Байрлалыг (`absolute`/`fixed`, талын зай) хэрэглэгч тал өөрөө өгнө.
     *
     * Урьд нь энд `absolute right-0` шууд бичээстэй байсан нь жижиг дэлгэц дээр
     * панелийг товчнаас зүүн тийш сунгаж, дэлгэцээс гаргадаг байв. Tailwind-ийн
     * ижил төрлийн утилитууд дараалалдаа тулгуурладаг тул className-аар дарж
     * болдоггүй — иймд суурьт нь байрлал ҮЛДЭЭХГҮЙ.
     */
    <div
      ref={dropdownRef}
      className={`z-40 rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark ${className}`}
    >
      {children}
    </div>
  );
};
