"use client";
import { ThemeProvider } from "@/context/ThemeContext";
import GridShape from "@/components/common/GridShape";
import Link from "next/link";
import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import SignUpForm from "./SignUpForm";
import Image from "next/image";

export default function RegisterPage() {
  return (
    <div className="relative min-h-screen bg-white p-4 text-gray-700 dark:bg-gray-900 dark:text-gray-200 sm:p-0">
      <ThemeProvider>
        <div className="relative flex min-h-screen w-full flex-col justify-center bg-white dark:bg-gray-900 lg:flex-row">
          <SignUpForm />

          <div className="hidden h-full w-full items-center justify-center bg-gradient-to-br from-brand-950 via-brand-900 to-gray-900 px-10 py-12 lg:flex lg:w-1/2">
            <div className="relative z-10 flex w-full max-w-md flex-col items-center justify-center rounded-[28px] border border-white/10 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-xl">
              <GridShape />
              <Link href="/" className="mb-5 block">
                <Image
                  width={231}
                  height={48}
                  src="/images/logo/auth-logo.svg"
                  alt="Logo"
                />
              </Link>
              <h2 className="mb-3 text-xl font-semibold text-white">
                Бүртгэл үүсгэсний дараа эрхийн мэдээллийг шалгана
              </h2>
              <p className="mb-6 text-sm leading-6 text-gray-300">
                Системийн админ таны хүсэлтийг хянаж, эрх олгох эсэхийг шийднэ. Хэрэв танд асуулт байвал холбогдоно уу.
              </p>
              <Link
                href="/admin-access"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              >
                Админ эрхийн дэлгэрэнгүй
              </Link>
            </div>
          </div>

          <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
            <ThemeTogglerTwo />
          </div>
        </div>
      </ThemeProvider>
    </div>
  );
}
