import { Metadata } from "next";

import PraiseAssetsPage from "@/components/assets/PraiseAssetsPage";

export const metadata: Metadata = {
  title: "Эд хөрөнгийн ерөнхий бүртгэл | ББУЧ",
  description: "Магтаалын аймгийн эд хөрөнгийн ерөнхий бүртгэл ба акталсан хөрөнгө",
};

/** Табууд: Ерөнхий бүртгэл, Акталсан хөрөнгийн бүртгэл (@see AssetTabs) */
export default function PraiseAssetRegisterPage() {
  return <PraiseAssetsPage title="Эд хөрөнгийн ерөнхий бүртгэл" section="register" />;
}
