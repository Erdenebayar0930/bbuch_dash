"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { useUser } from "../UserProvider";
import { signOutCompletely } from "@/lib/session";

/** AdminGuard-аас ирсэн шалтгаан бүрд харуулах тайлбар */
const reasons: Record<string, { title: string; description: string }> = {
  pending: {
    title: "Бүртгэл баталгаажаагүй байна",
    description:
      "Таны бүртгэл супер админ/админын баталгаажуулалтыг хүлээж байна. Баталгаажсаны дараа дахин нэвтэрнэ үү.",
  },
  blocked: {
    title: "Бүртгэл хаагдсан байна",
    description:
      "Таны хандах эрхийг түр хаасан байна. Дэлгэрэнгүй мэдээллийг админаас авна уу.",
  },
  admin: {
    title: "Админ эрх шаардлагатай",
    description: "Энэ хэсэгт зөвхөн админ эрхтэй хэрэглэгч нэвтэрч болно.",
  },
  "no-profile": {
    title: "Бүртгэл олдсонгүй",
    description:
      "Таны хэрэглэгчийн мэдээлэл системд бүртгэгдээгүй байна. Админтай холбогдоно уу.",
  },
};

const fallbackReason = {
  title: "Хандах эрхгүй байна",
  description: "Та энэ хуудсанд хандах эрхгүй байна.",
};

function UnauthorizedContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { logout } = useUser();

  const reason = reasons[params.get("reason") ?? ""] ?? fallbackReason;

  const handleLogout = async () => {
    await signOutCompletely();
    logout();
    router.replace("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-error-50 text-error-500 dark:bg-error-500/15">
          <ShieldAlert className="h-7 w-7" strokeWidth={1.8} />
        </span>

        <h1 className="mt-5 text-xl font-semibold text-gray-900 dark:text-white">
          {reason.title}
        </h1>
        <p className="mt-2 text-theme-sm text-gray-500 dark:text-gray-400">
          {reason.description}
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            Гарах
          </button>

          <Link
            href="/login"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            Нэвтрэх хуудас
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <Suspense>
      <UnauthorizedContent />
    </Suspense>
  );
}
