import { Metadata } from "next";

import SettingsView from "@/components/settings/SettingsView";

export const metadata: Metadata = {
  title: "Профайл | Бид туслая",
  description: "Хэрэглэгчийн мэдээлэл, тохиргоо",
};

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Профайл
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Хувийн мэдээлэл болон бүртгэлийн тохиргоо
        </p>
      </div>

      <SettingsView />
    </div>
  );
}
