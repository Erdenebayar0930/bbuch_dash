import { Metadata } from "next";

import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata: Metadata = {
  title: "Хандив | ББУЧ",
  description: "Хандивын орлогын бүртгэл",
};

/** Санхүү → Хандив. Агуулга нь хараахан тодорхойгүй (цэс нь зөвхөн админд). */
export default function FinanceDonationsPage() {
  return <ComingSoon title="Хандив" description="Хандивын орлогын бүртгэл" />;
}
