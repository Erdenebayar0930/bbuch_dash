import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import SendNotification from "@/components/admin/SendNotification";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Notification илгээх | Admin Dashboard",
  description: "Admin notification илгээх хуудас",
};

export default function NotificationsPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Notification илгээх" />
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <SendNotification />
      </div>
    </div>
  );
}
