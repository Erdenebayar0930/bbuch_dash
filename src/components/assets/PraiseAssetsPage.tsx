import AimagGuard from "@/components/AimagGuard";
import { ASSET_HEADER_SLOT } from "@/components/assets/AssetRegistry";
import AssetTabs, { type AssetSection } from "@/components/assets/AssetTabs";
import { aimags, labelOf } from "@/data/profileOptions";

/** profileOptions доторх түлхүүр — эд хөрөнгийн цэсүүд Магтаалын аймагт */
const AIMAG = "praise";

type PraiseAssetsPageProps = {
  title: string;
  section: AssetSection;
};

/** Магтаалын эд хөрөнгийн хоёр цэсийн нийтлэг хуудас — гарчиг, табууд */
export default function PraiseAssetsPage({ title, section }: PraiseAssetsPageProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Гарчиг (зүүн) ба Ерөнхий бүртгэлийн үйлдлийн товчнууд (баруун захад
          шахагдсан) — AssetRegistry товчнуудаа энд portal-оор гаргана */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            {labelOf(aimags, AIMAG)}-т харьяалагдах эд хөрөнгө
          </p>
        </div>
        <div id={ASSET_HEADER_SLOT} className="ml-auto flex flex-wrap items-center justify-end gap-2 empty:hidden" />
      </div>

      <AimagGuard aimag={AIMAG}>
        <AssetTabs section={section} aimag={AIMAG} />
      </AimagGuard>
    </div>
  );
}
