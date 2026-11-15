import { Metadata } from "next";

import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata: Metadata = {
  title: "Өглөг | ББУЧ",
  description: "Өглөгийн бүртгэл",
};

/** Санхүү → Өглөг. Агуулга нь хараахан тодорхойгүй (цэс нь зөвхөн админд). */
export default function FinanceAlmsPage() {
  return <ComingSoon title="Өглөг" description="Өглөгийн бүртгэл" />;
}
