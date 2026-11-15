import { Metadata } from "next";

import TitheOfferingTabs from "@/components/finance/TitheOfferingTabs";

export const metadata: Metadata = {
  title: "1/10 ба өргөл | ББУЧ",
  description: "1/10 ба өргөлийн мэдээлэл, өргөж буй байдал",
};

/** Санхүү → 1/10 ба өргөл. Табууд: «1/10 ба өргөлийн талаар», «Өргөж буй байдал». */
export default function AllocationPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
        1/10 ба өргөл
      </h1>

      <TitheOfferingTabs />
    </div>
  );
}
