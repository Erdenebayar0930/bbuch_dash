/** Профайлын сонголттой талбаруудын жагсаалт — UI ба серверийн шалгалт хоёулаа эндээс уншина. */

export type Option = { value: string; label: string };

/** MBTI — 16 төрөл */
export const mbtiTypes: Option[] = [
  { value: "ISTJ", label: "ISTJ — Логистик" },
  { value: "ISFJ", label: "ISFJ — Хамгаалагч" },
  { value: "INFJ", label: "INFJ — Өмгөөлөгч" },
  { value: "INTJ", label: "INTJ — Стратегич" },
  { value: "ISTP", label: "ISTP — Урлаач" },
  { value: "ISFP", label: "ISFP — Адал явдалт" },
  { value: "INFP", label: "INFP — Эвлэрүүлэгч" },
  { value: "INTP", label: "INTP — Сэтгэгч" },
  { value: "ESTP", label: "ESTP — Бизнесмен" },
  { value: "ESFP", label: "ESFP — Тоглуулагч" },
  { value: "ENFP", label: "ENFP — Уриалагч" },
  { value: "ENTP", label: "ENTP — Мэтгэлцэгч" },
  { value: "ESTJ", label: "ESTJ — Гүйцэтгэгч" },
  { value: "ESFJ", label: "ESFJ — Элч" },
  { value: "ENFJ", label: "ENFJ — Удирдагч" },
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
 */
export const aimags: Option[] = [
  { value: "guard", label: "Харуулын аймаг" },
  { value: "praise", label: "Магтаалын аймаг" },
  { value: "supply", label: "Хангамжийн аймаг" },
  { value: "commission", label: "Агуу захирамжийн аймаг" },
  { value: "service", label: "Туслах үйлчлэх аймаг" },
];

/** Сонголтын утга зөв эсэхийг шалгана — сервер тал ашиглана */
export const isValidOption = (options: Option[], value: string) =>
  value === "" || options.some((option) => option.value === value);

/** Утгыг харагдах нэр рүү хөрвүүлнэ */
export const labelOf = (options: Option[], value: string) =>
  options.find((option) => option.value === value)?.label ?? value;
