import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import GuardPointMap from "@/components/guard/GuardPointMap";
import { GUARD_AIMAG } from "@/data/guardOptions";

export const metadata: Metadata = {
  title: "Газрын зураг | ББУЧ",
  description: "Харуулын цэгүүдийн газрын зураг",
};

export default function GuardMapPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Газрын зураг
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Харуулын цэгүүд ба эргэлтийн бүртгэл
        </p>
      </div>

      <AimagGuard aimag={GUARD_AIMAG}>
        <GuardPointMap />
      </AimagGuard>
    </div>
  );
}
