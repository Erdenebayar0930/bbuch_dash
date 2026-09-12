import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import AssetRegistry from "@/components/assets/AssetRegistry";
import { aimags, labelOf } from "@/data/profileOptions";

/** profileOptions доторх түлхүүр — өөрчлөгдвөл энэ хуудас ч дагах ёстой */
const AIMAG = "praise";

export const metadata: Metadata = {
  title: "Магтаалын аймаг — Эд хөрөнгө | ББУЧ",
  description: "Магтаалын аймгийн эд хөрөнгийн бүртгэл",
};

export default function PraiseAssetsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Эд хөрөнгө бүртгэл
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          {labelOf(aimags, AIMAG)}-т харьяалагдах эд хөрөнгө
        </p>
      </div>

      <AimagGuard aimag={AIMAG}>
        <AssetRegistry aimag={AIMAG} />
      </AimagGuard>
    </div>
  );
}
