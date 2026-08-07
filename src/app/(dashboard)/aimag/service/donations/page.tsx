import { Metadata } from "next";

import DonationBoxMap from "@/components/finance/DonationBoxMap";

export const metadata: Metadata = {
  title: "Хандивын хайрцаг | ББУЧ",
  description: "Хандивын хайрцгууд байрлаж буй газрын зураг",
};

export default function DonationBoxPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Хандивын хайрцаг
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Хайрцаг байрлаж буй цэгүүд
        </p>
      </div>

      {/* Хайрцаг хаана байрлаж байгаа нь — газрын зураг дээрх тэмдэглэгээ */}
      <DonationBoxMap />
    </div>
  );
}