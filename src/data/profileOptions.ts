/** Профайлын сонголттой талбаруудын жагсаалт — UI ба серверийн шалгалт хоёулаа эндээс уншина. */

export type Option = { value: string; label: string };

/**
 * MBTI — 16 төрөл. Шошгыг undesten.org/test/-ээс авав.
 *
 * ISTJ, INTJ, ISFP, ESTP, ESFP, ISTP, INFJ, INFP, ENFP, ENFJ-ийн нэрийг байгууллагын
 * хэрэглээнд тааруулж гараар тогтоосон.
 */
export const mbtiTypes: Option[] = [
  { value: "ISTJ", label: "ISTJ — Байцаагч" },
  { value: "ISFJ", label: "ISFJ — Хамгаалагч" },
  { value: "INFJ", label: "INFJ — Хөгжүүлэгч" },
  { value: "INTJ", label: "INTJ — Стратегич" },
  { value: "ISTP", label: "ISTP — Урлаач" },
  { value: "ISFP", label: "ISFP — Урлагийн хүн" },
  { value: "INFP", label: "INFP — Романтик" },
  { value: "INTP", label: "INTP — Логикч" },
  { value: "ESTP", label: "ESTP — Сурталчлагч" },
  { value: "ESFP", label: "ESFP — Аялагч тоглогч" },
  { value: "ENFP", label: "ENFP — Идэвхжүүлэгч" },
  { value: "ENTP", label: "ENTP — Мэтгэлцэгч" },
  { value: "ESTJ", label: "ESTJ — Хянагч" },
  { value: "ESFJ", label: "ESFJ — Гүйцэтгэгч" },
  { value: "ENFJ", label: "ENFJ — Ментор" },
  { value: "ENTJ", label: "ENTJ — Командлагч" },
];

/** Хайрын 5 хэл */
export const loveLanguages: Option[] = [
  { value: "words", label: "Урамшуулах үг" },
  { value: "time", label: "Чанартай цаг (Хамт цаг өнгөрүүлэх)" },
  { value: "gifts", label: "Бэлэг өгөх, авах" },
  { value: "service", label: "Туслах, үйлчлэх үйлдлүүд" },
  { value: "touch", label: "Хүрэлцэх (Physical Touch)" },
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
