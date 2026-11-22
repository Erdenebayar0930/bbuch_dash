import AimagGuard from "@/components/AimagGuard";
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
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          {labelOf(aimags, AIMAG)}-т харьяалагдах эд хөрөнгө
        </p>
      </div>

      <AimagGuard aimag={AIMAG}>
        <AssetTabs section={section} aimag={AIMAG} />
      </AimagGuard>
    </div>
  );
}
