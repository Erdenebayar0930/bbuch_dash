import { Metadata } from "next";

import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata: Metadata = {
  title: "Хангамж | ББУЧ",
  description: "Санхүүгийн хангамжийн бүртгэл",
};

/** Санхүү → Хангамж. Агуулга нь хараахан тодорхойгүй (цэс нь зөвхөн админд). */
export default function FinanceSupplyPage() {
  return <ComingSoon title="Хангамж" description="Санхүүгийн хангамжийн бүртгэл" />;
}
