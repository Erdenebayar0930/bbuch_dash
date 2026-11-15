import { Metadata } from "next";

import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata: Metadata = {
  title: "Газрын 1/10 | ББУЧ",
  description: "Газрын аравны нэгийн бүртгэл",
};

/** Санхүү → Газрын 1/10. Агуулга нь хараахан тодорхойгүй (цэс нь зөвхөн админд). */
export default function LandTithePage() {
  return <ComingSoon title="Газрын 1/10" description="Газрын аравны нэгийн бүртгэл" />;
}
