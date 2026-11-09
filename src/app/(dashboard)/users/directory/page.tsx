import { Metadata } from "next";

import AdminGuard from "@/app/(auth)/AdminGuard";
import UserDirectory from "@/components/admin/UserDirectory";

export const metadata: Metadata = {
  title: "Хэрэглэгчийн мэдээлэл | ББУЧ",
  description: "Хэрэглэгчдийн дэлгэрэнгүй мэдээлэл ба тайлан",
};

export default function UserDirectoryPage() {
  return (
    <AdminGuard requireAdmin>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Хэрэглэгчийн мэдээлэл
          </h1>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            Профайлын дэлгэрэнгүй мэдээлэл. Хүн дээр дарж бүрэн тайланг нь харна.
          </p>
        </div>

        <UserDirectory />
      </div>
    </AdminGuard>
  );
}
