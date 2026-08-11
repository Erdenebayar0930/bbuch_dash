/**
 * Чуулганы хандивын данснууд.
 *
 * Дансууд өөрсдөө БААЗАД сууна (`donation_accounts`) — админ нэмж, засаж
 * чадах ёстой. Энд зөвхөн өөрчлөгддөггүй зүйл үлдэв: банкны нэршил, апп
 * нээх scheme, ба хоосон бааз дээр нэг удаа суух анхны жагсаалт.
 */

export type Bank = "khan" | "state";

/** Баазаас ирэх дансны хэлбэр — API `canView`-г дуудагч тус бүрд бодож өгнө */
export type DonationAccount = {
  id: string;
  /** Дансны зориулалт */
  title: string;
  /** IBAN хэлбэрийн дансны дугаар */
  number: string;
  /** `bankNames` доторх түлхүүр — танихгүй бол хоосон */
  bank: string;
  /** Данс эзэмшигчийн нэр */
  holder: string;
  position: number;
  /** «1/10 ба өргөл» хуудас энэ дансыг харуулна */
  isTithe: boolean;
  /** Дуудагч энэ дансны ГҮЙЛГЭЭГ харж болох эсэх (карт нь бүгдэд харагдана) */
  canView: boolean;
  /**
   * Эрх олгогдсон хэрэглэгчид — зөвхөн админд ирнэ.
   * Энэ ба `allowedAimags` хоёулаа хоосон бол данс бүгдэд нээлттэй.
   */
  allowedUids?: string[];
  /** Эрх олгогдсон аймгууд — зөвхөн админд ирнэ */
  allowedAimags?: string[];
};

export const bankNames: Record<Bank, string> = {
  khan: "Хаанбанк",
  state: "Төрийн банк",
};

export const isBank = (value: string): value is Bank => value in bankNames;

/** Банкны нэр — танихгүй түлхүүр бол хоосон мөр */
export const bankLabel = (value: string) =>
  isBank(value) ? bankNames[value] : "";

/**
 * Утасны банкны аппыг нээх URL scheme.
 *
 * ⚠ Эдгээр нь банк тус бүрийн апп дээр өөр байдаг бөгөөд албан ёсоор
 * баримтжуулаагүй. Апп суулгаагүй эсвэл scheme таарахгүй бол юу ч болохгүй —
 * тиймээс дарах бүрд дансны дугаарыг ЗААВАЛ хуулна (энэ нь үргэлж ажиллана).
 */
export const bankAppSchemes: Record<Bank, string> = {
  khan: "khanbank://",
  state: "statebank://",
};

/** Хоосон бааз дээр нэг удаа суух данснууд */
export const seedDonationAccounts = [
  {
    title: "1/10 ба өргөл",
    number: "MN100005005312334127",
    bank: "khan",
    holder: "Мөнгөнцэцэг",
    // «1/10 ба өргөл» хуудас анхнаасаа ажиллахын тулд энэ данс тэмдэглэгдэнэ
    isTithe: true,
  },
  {
    title: "Газар худалдаж авах",
    number: "MN530034106201877867",
    bank: "state",
    holder: "Мөнгөнцэцэг",
    isTithe: false,
  },
  {
    title: "Зорилтот хандив",
    number: "MN960034106201877869",
    bank: "state",
    holder: "Мөнгөнцэцэг",
    isTithe: false,
  },
  {
    title: "Илгээлтийн сан",
    number: "MN290034106201880239",
    bank: "state",
    holder: "Мөнгөнцэцэг",
    isTithe: false,
  },
  {
    title: "Тахилт заал барихад зориулсан данс",
    number: "MN140034106201880897",
    bank: "state",
    holder: "Мөнгөнцэцэг",
    isTithe: false,
  },
];

/** Дугаарыг 4-өөр бүлэглэж уншихад хялбар болгоно */
export const formatAccountNumber = (value: string) =>
  value.replace(/(.{4})/g, "$1 ").trim();

/**
 * Дансны нэрийг олно — олдохгүй бол дугаарыг нь өөрийг нь буцаана.
 *
 * Жагсаалтыг дуудагч талаас өгнө: данс баазад байдаг тул энэ модуль дангаараа
 * мэдэхгүй.
 */
export const accountTitle = (
  accounts: Pick<DonationAccount, "number" | "title">[],
  value: string
) => accounts.find((item) => item.number === value)?.title ?? value;
