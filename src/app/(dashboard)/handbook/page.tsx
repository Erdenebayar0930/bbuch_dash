import { Metadata } from "next";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "Гарын авлага | ББУЧ",
  description: "Заавар, журам, гарын авлага",
};

export default function HandbookPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Гарын авлага
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Заавар, журам, албан ёсны баримт бичиг
        </p>
      </div>

      <div className="surface flex min-h-[320px] flex-col items-center justify-center gap-2 p-6 text-center">
        <BookOpen
          className="h-9 w-9 text-gray-300 dark:text-gray-600"
          strokeWidth={1.5}
        />
        <p className="text-base font-medium text-gray-800 dark:text-white/90">
          Гарын авлага
        </p>
        <p className="max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
          Энэ хэсэг бэлтгэгдэж байна.
        </p>
      </div>
    </div>
  );
}
