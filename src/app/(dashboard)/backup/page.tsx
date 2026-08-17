import type { Metadata } from "next";

import AdminGuard from "@/app/(auth)/AdminGuard";
import BackupManager from "@/components/admin/BackupManager";
import SuperOnly from "./SuperOnly";

export const metadata: Metadata = {
  title: "Нөөцлөлт | Бид туслая",
  description: "Өгөгдлийн сангийн хуулбар — үүсгэх, татах, төлөв шалгах",
};

export default function BackupPage() {
  return (
    <AdminGuard requireAdmin>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Нөөцлөлт
          </h1>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            Хуулбар нь Google Drive дээр, серверээс гадна хадгалагдана —
            сервер бүхэлдээ алдагдсан ч өгөгдөл үлдэнэ.
          </p>
        </div>

        <SuperOnly>
          <BackupManager />
        </SuperOnly>
      </div>
    </AdminGuard>
  );
}
