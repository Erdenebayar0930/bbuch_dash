"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import { getSchedulePosterUrl } from "@/lib/schedule";
import { isAdminRole } from "@/lib/permissions";

/** Хянах самбар дээрх долоо хоногийн хуваарийн постер зураг. */
export default function WeeklySchedule() {
  const { user } = useUser();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canEdit = isAdminRole(user?.role);

  useEffect(() => {
    let cancelled = false;

    getSchedulePosterUrl()
      .then((url) => {
        if (!cancelled) setImageUrl(url);
      })
      .catch((err) => {
        console.error("Долоо хоногийн хуваарь татахад алдаа гарлаа:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || imageUrl === null) return null;

  if (!imageUrl) {
    if (!canEdit) return null;

    return (
      <Link
        href="/admin/schedule"
        className="surface flex items-center justify-between gap-3 p-5 transition-colors hover:border-brand-300 dark:hover:border-brand-500/40"
      >
        <span className="text-theme-sm text-gray-500 dark:text-gray-400">
          Долоо хоногийн хуваарийн зураг оруулаагүй байна.
        </span>
        <span className="inline-flex items-center gap-1.5 text-theme-sm font-medium text-brand-600 dark:text-brand-400">
          <Pencil className="h-4 w-4" strokeWidth={1.8} />
          Оруулах
        </span>
      </Link>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {canEdit && (
        <Link
          href="/admin/schedule"
          className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-theme-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-white"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
          Засах
        </Link>
      )}

      {/* Админ дурын хэмжээтэй постер байршуулдаг тул intrinsic харьцааг нь хадгална */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Долоо хоногийн хуваарь"
        className="block w-full rounded-2xl"
      />
    </div>
  );
}
