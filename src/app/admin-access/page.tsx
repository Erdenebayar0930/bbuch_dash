import Link from "next/link";

export const metadata = {
  title: "Админ эрхийн мэдээлэл",
  description: "«Бид туслая» системд админ эрх авах заавар",
};

export default function AdminAccessPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12 text-gray-700 dark:bg-gray-900 dark:text-gray-200 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">
            Админ эрх
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
            Админ эрх авах заавар
          </h1>
          <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-400">
            Бүртгэл үүсгэсний дараа таны хүсэлтийг админ хянаж, эрх олгох эсэхийг шийднэ. Бүртгэлээ амжилттай үүсгэсний дараа доорх дугаараар шууд холбогдоно уу.
          </p>
        </div>


        <div className="space-y-3 text-sm leading-7 text-gray-600 dark:text-gray-400">
          <p>
            1. Бүртгүүлсэн имэйл хаягаа болон овог, нэрээ бэлэн байлгаарай.
          </p>
          <p>
            2. Админтай холбогдож, системд нэвтрэх хүсэлтээ илэрхийлнэ үү.
          </p>
          <p>
            3. Таны хүсэлт батлагдсаны дараа системд админ эрх автоматаар олгогдоно.
          </p>
        </div>

        <Link
          href="/login"
          className="inline-flex w-fit items-center rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          Нэвтрэх хуудас руу буцах
        </Link>
      </div>
    </main>
  );
}
