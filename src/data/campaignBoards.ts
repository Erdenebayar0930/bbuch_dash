/**
 * Хандив ба Өглөг — нэг бүтэцтэй (`donation_campaigns`, `board` баганаар
 * ялгана) тул нэг кодоор ажиллана; ялгаа нь нэршил, хаяг, төрөл.
 */
export type CampaignBoardKey = "donation" | "alms";

export type CampaignBoardInfo = {
  /** Нэрлэх тийн ялгал — «хандив», «өглөг» */
  noun: string;
  /** Том үсгээр — «Хандив», «Өглөг» */
  title: string;
  /** Харьяалах — «хандивын», «өглөгийн» */
  genitive: string;
  /** Заах — «хандивыг», «өглөгийг» */
  accusative: string;
  /** Өөрийн — «хандиваа», «өглөгөө» */
  reflexive: string;
  /** Хуудасны хаяг — мэдэгдэл дарахад шилжинэ */
  url: string;
  /** Шинээр нээх товч */
  create: string;
  /** Картын доорх уриа */
  cta: string;
  /** Зөвхөн нэг удаагийнх уу (Өглөг) */
  onceOnly: boolean;
  /** Данс нь аян бүрд гараар оруулагдана уу (Өглөг) — үгүй бол `CAMPAIGN_ACCOUNT` */
  ownAccount: boolean;
  /** Нээлттэйн таб — Өглөг: «Өглөг цуглуулах» */
  openLabel: string;
  /** Хаагдсаны таб — Хандив: «Дууссан», Өглөг: «Өгсөн» */
  closedLabel: string;
};

export const campaignBoards: Record<CampaignBoardKey, CampaignBoardInfo> = {
  donation: {
    noun: "хандив",
    title: "Хандив",
    genitive: "хандивын",
    accusative: "хандивыг",
    reflexive: "хандиваа",
    url: "/finance/donations",
    create: "Хандив зарлах",
    cta: "Хандив өргөх",
    onceOnly: false,
    ownAccount: false,
    openLabel: "Нэг удаа",
    closedLabel: "Дууссан",
  },
  alms: {
    noun: "өглөг",
    title: "Өглөг",
    genitive: "өглөгийн",
    accusative: "өглөгийг",
    reflexive: "өглөгөө",
    url: "/finance/alms",
    create: "Өглөг үүсгэх",
    cta: "Өглөг өгөх",
    onceOnly: true,
    ownAccount: true,
    openLabel: "Өглөг цуглуулах",
    closedLabel: "Өгсөн",
  },
};

export const isCampaignBoard = (value: unknown): value is CampaignBoardKey =>
  value === "donation" || value === "alms";
