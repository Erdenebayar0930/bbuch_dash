import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata: Metadata = {
  title: "Сургалт | ББУЧ",
  description: "Тахилтын сургалт",
};

/** Тахилт → Сургалт. Агуулга нь хараахан тодорхойгүй. */
export default function TahiltTrainingPage() {
  return (
    <AimagGuard aimag="tahilt">
      <ComingSoon title="Сургалт" description="Тахилтын сургалт" />
    </AimagGuard>
  );
}
