import { Metadata } from "next";

import AboutTabs from "@/components/finance/AboutTabs";
import CampaignBoard from "@/components/finance/CampaignBoard";

export const metadata: Metadata = {
  title: "Хандив | ББУЧ",
  description: "Тухайн үед зарласан хандивын аянууд",
};

/**
 * Санхүү → Хандив. Табууд: «Хандивын талаар» (нийтлэл) | «Хандив» — тухайн үед
 * зарласан хандивууд, бүгд харж, бүгд зарлана (зөвшөөрөлтэй).
 */
export default function FinanceDonationsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Хандив</h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Тухайн үед зарласан хандив — данс, гүйлгээний утгаа хуулж өргөнө
        </p>
      </div>

      <AboutTabs board="donation" mainLabel="Хандив">
        <CampaignBoard />
      </AboutTabs>
    </div>
  );
}
