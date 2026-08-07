/** Чуулганы тогтмол хандивын дансууд */

export type Bank = "khan" | "state";

export type DonationAccount = {
  /** Дансны зориулалт */
  title: string;
  /** IBAN хэлбэрийн дансны дугаар */
  number: string;
  bank: Bank;
  /** Данс эзэмшигчийн нэр */
  holder: string;
};

export const bankNames: Record<Bank, string> = {
  khan: "Хаанбанк",
  state: "Төрийн банк",
};

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

export const donationAccounts: DonationAccount[] = [
  {
    title: "1/10 ба өргөл",
    number: "MN100005005312334127",
    bank: "khan",
    holder: "Мөнгөнцэцэг",
  },
  {
    title: "Газар худалдаж авах",
    number: "MN530034106201877867",
    bank: "state",
    holder: "Мөнгөнцэцэг",
  },
  {
    title: "Зорилтот хандив",
    number: "MN960034106201877869",
    bank: "state",
    holder: "Мөнгөнцэцэг",
  },
  {
    title: "Илгээлтийн сан",
    number: "MN290034106201880239",
    bank: "state",
    holder: "Мөнгөнцэцэг",
  },
  {
    title: "Тахилт заал барихад зориулсан данс",
    number: "MN140034106201880897",
    bank: "state",
    holder: "Мөнгөнцэцэг",
  },
];

/** Дугаарыг 4-өөр бүлэглэж уншихад хялбар болгоно */
export const formatAccountNumber = (value: string) =>
  value.replace(/(.{4})/g, "$1 ").trim();
