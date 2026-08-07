import { Metadata } from "next";

import DonationAccounts from "@/components/finance/DonationAccounts";

export const metadata: Metadata = {
  title: "Санхүү | ББУЧ",
  description: "Тогтмол хандивын дансууд",
};

export default function FinancePage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Санхүү
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Хандив, өргөл хүлээн авах дансууд
        </p>
      </div>

      <DonationAccounts />
    </div>
  );
}
