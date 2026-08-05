import { Metadata } from "next";

import NotificationList from "./NotificationList";

export const metadata: Metadata = {
  title: "Мэдэгдэл | ББУЧ",
  description: "Ирсэн мэдэгдлүүд",
};

export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Мэдэгдэл
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Танд ирсэн мэдэгдлүүд — уншаагүй нь тодруулагдана
        </p>
      </div>

      <NotificationList />
    </div>
  );
}
