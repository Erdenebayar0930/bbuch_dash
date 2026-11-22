import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import PraiseHallTabs from "@/components/praise/PraiseHallTabs";

export const metadata: Metadata = {
  title: "Асрын үйлчлэл | ББУЧ",
  description: "Асрын үйлчлэлийн талаар, тушаал ба онцлогууд, хуваарь",
};

/**
 * Магтаалын аймгийн «Асрын үйлчлэл» — гурван таб (@see PraiseHallTabs):
 * талаарх нийтлэл, нэр цохож болдог тушаал ба онцлогууд, ээлжийн хуваарь.
 */
export default function PraiseHallPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Асрын үйлчлэл</h1>

      <AimagGuard aimag="praise">
        <PraiseHallTabs />
      </AimagGuard>
    </div>
  );
}
