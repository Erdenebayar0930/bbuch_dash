import { Metadata } from "next";

import HandbookList from "@/components/handbook/HandbookList";

export const metadata: Metadata = {
  title: "Гарын авлага | ББУЧ",
  description: "Заавар, журмын баримт бичгүүд",
};

export default function HandbookPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Гарын авлага
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Заавар, журмын баримт бичгүүд
        </p>
      </div>

      <HandbookList />
    </div>
  );
}
