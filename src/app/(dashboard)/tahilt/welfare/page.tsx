import { Metadata } from "next";

import WelfareMap from "@/components/welfare/WelfareMap";

export const metadata: Metadata = {
  title: "Халамжийн үйлчлэл | ББУЧ",
  description: "Халамжид хамрагдсан өрхүүд, үзүүлсэн тусламжийн бүртгэл",
};

export default function WelfarePage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Халамжийн үйлчлэл
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Хамрагдсан өрхийн байршил, үзүүлсэн халамжийн бүртгэл
        </p>
      </div>

      <WelfareMap />
    </div>
  );
}