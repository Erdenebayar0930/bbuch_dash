import { Metadata } from "next";

import SchedulePosterUpload from "@/components/admin/SchedulePosterUpload";

export const metadata: Metadata = {
  title: "Долоо хоногийн хуваарь | ББУЧ",
  description: "Хянах самбарт харагдах долоо хоногийн хуваарийг засах",
};

export default function SchedulePage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Долоо хоногийн хуваарь
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Энд хийсэн өөрчлөлт хянах самбар дээр бүгдэд шууд харагдана.
        </p>
      </div>

      <SchedulePosterUpload />
    </div>
  );
}
