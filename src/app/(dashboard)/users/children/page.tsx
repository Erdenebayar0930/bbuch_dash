import { Metadata } from "next";

import AdminGuard from "@/app/(auth)/AdminGuard";
import ChildrenRegistry from "@/components/admin/ChildrenRegistry";

export const metadata: Metadata = {
  title: "Хүүхдийн бүртгэл | ББУЧ",
  description: "Гишүүдийн хүүхдийн нэгдсэн бүртгэл",
};

export default function ChildrenRegistryPage() {
  return (
    <AdminGuard requireAdmin>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Хүүхдийн бүртгэл
          </h1>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            Гишүүдийн профайлдаа бүртгэсэн хүүхдүүд — насны бүлэг, төрсөн сараар шүүнэ.
          </p>
        </div>

        <ChildrenRegistry />
      </div>
    </AdminGuard>
  );
}
