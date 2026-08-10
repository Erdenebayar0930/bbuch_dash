"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import { canSeeNavItem, shortcuts } from "@/layout/navigation";

/**
 * Үндсэн хуудаснаас бусад хэсэг рүү орох холбоосууд.
 *
 * Жагсаалт нь хажуугийн цэстэй нэг эх сурвалжтай (navigation.ts) — цэс нэмэхэд
 * энд ч бас өөрөө нэмэгдэнэ, шүүлт нь ч хажуугийн цэстэй ижил дүрмээр явна.
 */
export default function QuickLinks() {
  const { user } = useUser();

  const visible = shortcuts.filter((item) =>
    canSeeNavItem(item, { role: user?.role, aimags: user?.aimags })
  );

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {visible.map((item) => {
        const Icon = item.icon;

        return (
          <li key={item.path}>
            <Link
              href={item.path}
              className="group flex h-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-accent-300 hover:bg-accent-50/40 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-accent-500/40 dark:hover:bg-white/[0.06]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>

              <span className="min-w-0 flex-1">
                {/* Аймгийн нэрийг дээр нь бичихгүй бол «Эд хөрөнгө бүртгэл»
                    хаанахынх нь болох нь ойлгомжгүй */}
                {item.group && (
                  <span className="block truncate text-theme-xs text-gray-400">
                    {item.group}
                  </span>
                )}
                <span className="block truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                  {item.name}
                </span>
              </span>

              <ChevronRight
                className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-accent-500 dark:text-gray-600"
                strokeWidth={2}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
