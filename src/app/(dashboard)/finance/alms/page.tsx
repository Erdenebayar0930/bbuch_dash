import { Metadata } from "next";

import CampaignBoard from "@/components/finance/CampaignBoard";

export const metadata: Metadata = {
  title: "Өглөг | ББУЧ",
  description: "Нэг удаагийн өглөгүүд",
};

/**
 * Санхүү → Өглөг. Хандивтай ижил бүтэцтэй (зөвшөөрөл, мэдэгдэл, эрэмбэ)
 * боловч тусдаа жагсаалт, үргэлж нэг удаагийнх. Табууд: Идэвхтэй | Дууссан.
 */
export default function FinanceAlmsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Өглөг</h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Нэг удаагийн өглөг — данс, гүйлгээний утгаа хуулж өгнө
        </p>
      </div>

      <CampaignBoard board="alms" />
    </div>
  );
}
