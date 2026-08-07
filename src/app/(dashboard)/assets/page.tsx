import { Metadata } from "next";

import AssetRegistry from "@/components/assets/AssetRegistry";

export const metadata: Metadata = {
  title: "Эд хөрөнгө | ББУЧ",
  description: "Эд хөрөнгийн бүртгэл, агуулахууд",
};

export default function AssetsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Эд хөрөнгө
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Агуулах бүрийн эд хөрөнгийн бүртгэл
        </p>
      </div>

      <AssetRegistry />
    </div>
  );
}
