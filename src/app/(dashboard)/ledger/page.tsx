import { Metadata } from "next";

import AccountLedger from "@/components/finance/AccountLedger";

export const metadata: Metadata = {
  title: "Гүйлгээний бүртгэл | ББУЧ",
  description: "Хандивын данс тус бүрийн орлого, зарлагын бүртгэл",
};

export default function LedgerPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Гүйлгээний бүртгэл
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Данс тус бүрийн орлого, зарлага
        </p>
      </div>

      <AccountLedger />
    </div>
  );
}
