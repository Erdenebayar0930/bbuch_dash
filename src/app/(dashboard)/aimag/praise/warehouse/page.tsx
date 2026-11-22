import { Metadata } from "next";

import PraiseAssetsPage from "@/components/assets/PraiseAssetsPage";

export const metadata: Metadata = {
  title: "Агуулахын бүртгэл | ББУЧ",
  description: "Байршил бүрийн эд хөрөнгө ба ашиглалтын байдал",
};

/** Табууд: Агуулахын бүртгэл, Ашиглалтын байдал (@see AssetTabs) */
export default function PraiseWarehousePage() {
  return <PraiseAssetsPage title="Агуулахын бүртгэл" section="warehouse" />;
}
