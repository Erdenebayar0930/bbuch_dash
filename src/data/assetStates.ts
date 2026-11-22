/**
 * Эд хөрөнгийн ангилал — байршил (агуулах) бүрт хөрөнгө аль ангилалд байгааг
 * заана. Түлхүүр нь баазад бичигдэх утга тул шошгыг өөрчлөхөд өгөгдөл
 * хөндөгдөхгүй. Сервер (шалгалт) ба клиент (UI) хоёул эндээс уншина.
 *
 * Хөрөнгийн «Төрөл» (asset_categories — тавилга, хөгжим …) -өөс тусдаа:
 * төрөл нь ЮУ болохыг, ангилал нь ЯМАР БАЙДАЛТАЙ байгааг заана.
 */

export type AssetState = "registered" | "repair" | "in_use" | "written_off";

export const assetStates: AssetState[] = ["registered", "repair", "in_use", "written_off"];

export const assetStateLabels: Record<AssetState, string> = {
  registered: "Бүртгэлтэй",
  repair: "Засвартай",
  in_use: "Ашиглалтын байдал",
  written_off: "Акталсан",
};

/** Шошгоны өнгө — өнгө нь өөрөө мэдээлэл тул шошгыг нь ч бас бичнэ */
export const assetStateStyles: Record<AssetState, string> = {
  registered: "bg-blue-light-50 text-blue-light-700 dark:bg-blue-light-500/15 dark:text-blue-light-400",
  repair: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  in_use: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  written_off: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400",
};

export const DEFAULT_ASSET_STATE: AssetState = "registered";

export const isAssetState = (value: unknown): value is AssetState =>
  typeof value === "string" && assetStates.includes(value as AssetState);
