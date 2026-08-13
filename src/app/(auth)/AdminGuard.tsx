"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";

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

/**
 * Хэдэн удаа дараалан бүтэлгүйтвэл хэрэглэгчид алдааг харуулах вэ.
 *
 * 1 удаагийн алдаанд шууд сандрахгүй — сүлжээ агшин зуур тасарч болно.
 * Гэвч БАЙНГЫН алдааг (жишээ нь серверийн тохиргоо дутуу) чимээгүй нуувал
 * дэлгэц үүрд эргэлдэж, хэрэглэгчид ямар ч мэдээлэл, гарах зам үлдэхгүй.
 */
const FAILURE_LIMIT = 2;

/**
 * Firebase-ийн эхлэл өөрөө бүтэлгүйтвэл `onAuthStateChanged` НЭГ Ч УДАА
 * дуудагдахгүй — тэр үед дээрх тоолуур ч ажиллахгүй тул харуулах алдаа
 * гарахгүй. Энэ хамгаалагч тэр тохиолдлыг барина.
 */
const WATCHDOG_MS = 15_000;

export default function AdminGuard({ children, requireAdmin = false }: Props) {
  const router = useRouter();
  const { user, setUser } = useUser();
  const [verified, setVerified] = useState(false);

  /** Хэрэглэгчид харуулах алдаа — null бол эргэлдэгч дугуй харагдана */
  const [error, setError] = useState<string | null>(null);

  /** Дараалсан бүтэлгүйтлийн тоо. Амжилттай болмогц тэглэгдэнэ. */
  const failures = useRef(0);

  /**
   * Хамгийн сүүлд гарсан алдааны текст.
   *
   * Watchdog үүнийг ерөнхий мессежээс ДАВУУ үзнэ: шалгалт 60 секунд тутам
   * давтагддаг тул 15 секундын дотор ердөө 1 удаа унана — өөрөөр хэлбэл
   * `FAILURE_LIMIT`-д хүрэхээс өмнө watchdog асдаг. Үүнийг хийхгүй бол
   * серверийн тодорхой алдаа (жишээ нь "сан руу хандаж чадсангүй") дарагдаж,
   * хэрэглэгчид "холболтоо шалгана уу" гэсэн ташаа зөвлөгөө очно.
   */
  const lastError = useRef<string | null>(null);

  /**
   * Шалгалт нэг ч удаа амжилттай дууссан эсэх — watchdog үүнийг уншина.
   * `verified` төлөвийг шууд уншиж болохгүй: watchdog нь `useEffect` дотор
   * хаагдсан (closure) тул хуучин утгыг л харна.
   */
  const resolved = useRef(false);

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
    } catch (cause) {
      // Сүлжээний тасалдлаас болж хэрэглэгчийг гаргахгүй — эрхийн татгалзлыг
      // apiFetch өөрөө барьж forceSignOut дуудна.
      console.error("Профайл шалгахад алдаа гарлаа:", cause);

      failures.current += 1;

      const message =
        cause instanceof Error
          ? cause.message
          : "Профайл шалгахад тодорхойгүй алдаа гарлаа.";

      // Эхний алдаанаас эхлэн хадгална — харуулахгүй ч watchdog үүнийг авна
      lastError.current = message;

      // Дараалан хэд хэдэн удаа унавал энэ нь түр зуурын тасалдал биш —
      // хэрэглэгчид ил хэлж, дахин оролдох боломж өгнө.
      if (failures.current >= FAILURE_LIMIT) {
        setError(message);
      }

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
      // Цэсийг аймгаар шүүхэд хэрэгтэй — админ харьяаллыг сольмогц дараагийн
      // шалгалтаар цэс нь өөрөө шинэчлэгдэнэ
      aimags: profile.aimags,
    };

    // Өөрчлөгдөөгүй бол дэмий рендер хийхгүй. Өөрчлөгдсөн бол эрх нь шууд
    // идэвхжинэ — дахин нэвтрэх шаардлагагүй.
    const serialized = JSON.stringify(next);
    if (serialized !== lastWritten.current) {
      lastWritten.current = serialized;
      setUser(next);
    }

    // Сэргэсэн тул өмнөх алдааг цэвэрлэнэ. React нь утга ижил бол дахин
    // рендер хийхгүй тул 60 секунд тутмын шалгалт дэмий ажил үүсгэхгүй.
    failures.current = 0;
    lastError.current = null;
    resolved.current = true;
    setError(null);
    setVerified(true);
  }, [router, requireAdmin, setUser]);

  /** Хэрэглэгч "Дахин оролдох" дархад — тоолуурыг тэглээд шууд шалгана */
  const retry = useCallback(() => {
    failures.current = 0;
    setError(null);
    validate();
  }, [validate]);

  /** Гацсан үед гарах зам — сесс цэвэрлээд нэвтрэх хуудас руу буцаана */
  const leave = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (cause) {
      console.error("Гарахад алдаа гарлаа:", cause);
    }
    window.location.replace("/login");
  }, []);

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

    /**
     * Firebase огт хариу өгөхгүй бол (тохиргоо буруу, скрипт хаагдсан г.м.)
     * дээрх аль ч зам ажиллахгүй тул дэлгэц үүрд эргэлдэнэ. Тогтоосон хугацаа
     * өнгөрөхөд ямар нэг зүйл шийдэгдээгүй хэвээр байвал алдаа харуулна.
     */
    const watchdog = window.setTimeout(() => {
      if (resolved.current) return;

      // Тухайлсан алдаа мэдэгдэж байвал ЗААВАЛ түүнийг харуулна. Ерөнхий
      // мессеж нь зөвхөн юу ч болоогүй — өөрөөр хэлбэл Firebase огт хариу
      // өгөөгүй — тохиолдолд л зөв байна.
      setError(
        (previous) =>
          previous ??
          lastError.current ??
          "Нэвтрэлтийн үйлчилгээ хариу өгсөнгүй. Холболтоо шалгаад дахин оролдоно уу."
      );
    }, WATCHDOG_MS);

    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
      window.clearTimeout(watchdog);
    };
  }, [validate, router]);

  if (!cachedAllowed && !verified) {
    // Байнгын алдаа — эргэлдүүлсээр байхын оронд юу болсныг хэлж, гарц өгнө
    if (error) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-100 p-4 dark:bg-gray-900">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Эрх шалгаж чадсангүй
            </h2>
            <p className="mt-2 break-words text-sm text-gray-500 dark:text-gray-400">
              {error}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={retry}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
              >
                Дахин оролдох
              </button>
              <button
                type="button"
                onClick={leave}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Гарах
              </button>
            </div>
          </div>
        </div>
      );
    }

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
