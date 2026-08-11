import { Metadata } from "next";

import AdminGuard from "@/app/(auth)/AdminGuard";
import ManualEntry from "@/components/finance/ManualEntry";
import StatementImport from "@/components/finance/StatementImport";

export const metadata: Metadata = {
  title: "Гүйлгээ оруулах | ББУЧ",
  description: "Гараар эсвэл банкны хуулгаас гүйлгээ бүртгэх",
};

/**
 * Гүйлгээ бааз руу орох ЦОРЫН ГАНЦ цэг — гараар нэг нэгээр, эсвэл банкны
 * хуулгаас багцаар. Хоёуланг нэг хуудсанд байрлуулснаар «аль цэсээр
 * оруулдаг билээ» гэсэн эргэлзээ үлдэхгүй.
 */
export default function StatementPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Гүйлгээ оруулах
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Гараар нэг нэгээр, эсвэл Excel хуулгаас багцаар
        </p>
      </div>

      {/* Гүйлгээ бичих нь админы эрх — сервер тал мөн шалгадаг */}
      <AdminGuard requireAdmin>
        <div className="flex flex-col gap-5">
          <ManualEntry />

          <div>
            <h2 className="mb-3 text-base font-semibold text-gray-800 dark:text-white/90">
              Дансны хуулга уншуулах
            </h2>
            <StatementImport />
          </div>
        </div>
      </AdminGuard>
    </div>
  );
}
