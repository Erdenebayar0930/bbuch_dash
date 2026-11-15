import { Metadata } from "next";

import TitheOfferingTabs from "@/components/finance/TitheOfferingTabs";

export const metadata: Metadata = {
  title: "Газрын 1/10 | ББУЧ",
  description: "Газрын 1/10-ийн мэдээлэл, өргөх заавар",
};

/**
 * Санхүү → Газрын 1/10. «1/10 ба өргөл»-тэй ижил загвар: «Газрын 1/10-ийн
 * талаар», «Өргөх заавар» (Хаан банкны данс), админд «Өргөж буй байдал».
 */
export default function LandTithePage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Газрын 1/10</h1>

      <TitheOfferingTabs variant="land" />
    </div>
  );
}
