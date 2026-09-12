/** Профайлын сонголттой талбаруудын жагсаалт — UI ба серверийн шалгалт хоёулаа эндээс уншина. */

export type Option = { value: string; label: string };

/**
 * MBTI — 16 төрөл. Шошгыг undesten.org/test/-ээс авав.
 *
 * Тэр сайт дээр ISTP ба ESFJ хоёул адилхан "Гүйцэтгэгч" гэж давхардсан
 * тул ISTP-д (сайт өөр нэр өгөөгүй тул) хуучин "Урлаач" нэрийг үлдээв.
 * INFJ-ийн шошго тэнд бүтэн өгүүлбэр ("Зөн совинтой, мэдрэмжтэй, шүүх
 * хандлагатай, дотоод ертөнцөд төвлөрсөн") тул сонголтын жагсаалтад
 * багтаах "Зөн совинч" гэсэн товч хэлбэрт оруулав.
 */
export const mbtiTypes: Option[] = [
  { value: "ISTJ", label: "ISTJ — Хариуцлагатай хэрэгжүүлэгч" },
  { value: "ISFJ", label: "ISFJ — Хамгаалагч" },
  { value: "INFJ", label: "INFJ — Зөн совинч" },
  { value: "INTJ", label: "INTJ — Архитектор" },
  { value: "ISTP", label: "ISTP — Урлаач" },
  { value: "ISFP", label: "ISFP — Адал явдал эрэлхийлэгч" },
  { value: "INFP", label: "INFP — Мөрөөдөгч" },
  { value: "INTP", label: "INTP — Логикч" },
  { value: "ESTP", label: "ESTP — Ятгагч" },
  { value: "ESFP", label: "ESFP — Энтертайнэр" },
  { value: "ENFP", label: "ENFP — Урам зориг өдөөгч" },
  { value: "ENTP", label: "ENTP — Мэтгэлцэгч" },
  { value: "ESTJ", label: "ESTJ — Хянагч" },
  { value: "ESFJ", label: "ESFJ — Гүйцэтгэгч" },
  { value: "ENFJ", label: "ENFJ — Урам зориг өгөгч" },
  { value: "ENTJ", label: "ENTJ — Командлагч" },
];

/** Хайрын 5 хэл */
export const loveLanguages: Option[] = [
  { value: "words", label: "Урамшуулах үг" },
  { value: "time", label: "Хамт өнгөрүүлэх цаг" },
  { value: "gifts", label: "Бэлэг" },
  { value: "service", label: "Тусламж үйлчилгээ" },
  { value: "touch", label: "Биет ойртолт" },
];

/** Темперамент — сонгодог 4 төрөл */
export const temperaments: Option[] = [
  { value: "sanguine", label: "Сангвиник" },
  { value: "choleric", label: "Холерик" },
  { value: "phlegmatic", label: "Флегматик" },
  { value: "melancholic", label: "Меланхолик" },
];

/** Хүйс */
export const genders: Option[] = [
  { value: "male", label: "Эрэгтэй" },
  { value: "female", label: "Эмэгтэй" },
];

/**
 * Аймаг — чуулганы үйлчлэлийн нэгжүүд (газарзүйн аймаг БИШ).
 *
 * Утга нь латин түлхүүр: нэршил өөрчлөгдвөл шошгыг л засна, баазад
 * хадгалагдсан өгөгдөл хэвээр үлдэнэ. Мэдэгдэл илгээхэд бүлэг болж
 * ашиглагдана — тиймээс дараалал нь UI дээрх дарааллыг тодорхойлно.
 *
 * Тахилт нь "аймаг" гэж нэрлэгддэггүй ч мөн адил үйлчлэлийн нэгж: хүн
 * харьяалуулж, цэсийн эрхийг нь энэ жагсаалтаар олгодог тул энд орсон.
 */
export const aimags: Option[] = [
  { value: "guard", label: "Харуулын аймаг" },
  { value: "praise", label: "Магтаалын аймаг" },
  { value: "supply", label: "Хангамжийн аймаг" },
  { value: "commission", label: "Агуу захирамжийн аймаг" },
  { value: "service", label: "Туслах үйлчлэх аймаг" },
  { value: "tahilt", label: "Тахилт" },
];

/** Сонголтын утга зөв эсэхийг шалгана — сервер тал ашиглана */
export const isValidOption = (options: Option[], value: string) =>
  value === "" || options.some((option) => option.value === value);

/** Утгыг харагдах нэр рүү хөрвүүлнэ */
export const labelOf = (options: Option[], value: string) =>
  options.find((option) => option.value === value)?.label ?? value;
