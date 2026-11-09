import { Metadata } from "next";

import AdminGuard from "@/app/(auth)/AdminGuard";
import UserReportView from "@/components/admin/UserReportView";

export const metadata: Metadata = {
  title: "Хэрэглэгчийн тайлан | ББУЧ",
  description: "Хэрэглэгчийн дэлгэрэнгүй тайлан",
};

export default function UserReportPage() {
  return (
    <AdminGuard requireAdmin>
      <UserReportView />
    </AdminGuard>
  );
}
