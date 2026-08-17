"use client";

import { useUser } from "@/app/(auth)/UserProvider";
import { isSuperRole } from "@/lib/permissions";

/**
 * Зөвхөн супер админд агуулгыг үзүүлнэ.
 *
 * ⚠ Энэ нь ЗӨВХӨН UI-гийн давхарга. Жинхэнэ хамгаалалт нь `/api/backup`
 * доторх `requireSuper` — тэр нь хаягаар шууд орсон ч, гараар хүсэлт
 * илгээсэн ч ажиллана. Энд байгаа нь энгийн админд утгагүй товч харуулж,
 * дараад алдаа авахаас сэргийлэх зорилготой.
 */
export default function SuperOnly({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useUser();

  if (!isSuperRole(user?.role)) {
    return (
      <div className="surface flex min-h-[240px] flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-base font-medium text-gray-800 dark:text-white/90">
          Хандах эрхгүй
        </p>
        <p className="max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
          Өгөгдлийн сангийн хуулбар нь бүх хэрэглэгчийн мэдээллийг агуулдаг тул
          зөвхөн супер админд нээлттэй.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
