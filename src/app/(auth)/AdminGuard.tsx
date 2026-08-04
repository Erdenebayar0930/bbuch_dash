"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { isAdminRole } from "@/lib/permissions";
import { forceSignOut } from "@/lib/session";
import { getCurrentUser } from "@/lib/users";
import { useUser } from "./UserProvider";

type Props = {
  children: React.ReactNode;
  /** Зөвхөн админ эрхтэй хэрэглэгчийг нэвтрүүлэх эсэх */
  requireAdmin?: boolean;
};

/** Эрх хаагдсаныг хэдэн секундэд барихыг тодорхойлно */
const REVALIDATE_MS = 60_000;

export default function AdminGuard({ children, requireAdmin = false }: Props) {
  const router = useRouter();
  const { user, setUser } = useUser();
  const [verified, setVerified] = useState(false);

  // ✅ кэш байвал дэлгэцийг шууд үзүүлнэ — шалгалт ард нь үргэлжилнэ
  const cachedAllowed = !!user && (!requireAdmin || isAdminRole(user.role));

  /**
   * Хамгийн сүүлд context-д бичсэн утга. Хамаарлын жагсаалтад `user`-ыг
   * оруулахгүйн тулд ref-ээр хадгална — эс бөгөөс шалгалт бүр шинэ рендер
   * үүсгээд, тэр нь дахин шалгалт дуудна.
   */
  const lastWritten = useRef<string>("");

  /**
   * Серверээс профайлыг дахин уншиж эрхийг батална.
   *
   * Кэш байсан ч ЗААВАЛ ажиллана: өмнө нь sessionStorage-д итгээд серверт
   * огт хандахгүй байсан тул админ хэрэглэгчийг хаасан ч тэр хүн таб хаатал
   * системд үлддэг байв.
   */
  const validate = useCallback(async () => {
    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }

    let profile;

    try {
      profile = await getCurrentUser();
    } catch (error) {
      // Сүлжээний тасалдлаас болж хэрэглэгчийг гаргахгүй — эрхийн татгалзлыг
      // apiFetch өөрөө барьж forceSignOut дуудна.
      console.error("Профайл шалгахад алдаа гарлаа:", error);
      return;
    }

    if (!profile) {
      await forceSignOut("no-profile");
      return;
    }

    if (profile.status !== "active") {
      await forceSignOut(profile.status === "pending" ? "pending" : "blocked");
      return;
    }

    if (requireAdmin && !isAdminRole(profile.role)) {
      router.replace("/unauthorized?reason=admin");
      return;
    }

    const next = {
      uid: profile.uid,
      email: profile.email,
      first_name: profile.first_name,
      last_name: profile.last_name,
      role: profile.role,
      status: profile.status,
      photoURL: profile.photo_url,
    };

    // Өөрчлөгдөөгүй бол дэмий рендер хийхгүй. Өөрчлөгдсөн бол эрх нь шууд
    // идэвхжинэ — дахин нэвтрэх шаардлагагүй.
    const serialized = JSON.stringify(next);
    if (serialized !== lastWritten.current) {
      lastWritten.current = serialized;
      setUser(next);
    }

    setVerified(true);
  }, [router, requireAdmin, setUser]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.replace("/login");
        return;
      }

      validate();
    });

    // Таб руу буцаж ирэхэд шалгана — өөр цонхонд байх зуур хаасан байж болно
    const onVisible = () => {
      if (document.visibilityState === "visible") validate();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Нэг хуудсан дээр удаан сууж байхад ч эрхийн өөрчлөлт барина
    const timer = window.setInterval(validate, REVALIDATE_MS);

    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [validate, router]);

  if (!cachedAllowed && !verified) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-primary dark:border-gray-700 dark:border-t-primary"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Эрх шалгаж байна...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
