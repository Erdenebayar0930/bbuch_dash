/**
 * Системийн use case диаграмын өгөгдөл — хэн (оролцогч) ямар үйлдэл (use case)
 * хийдгийг нэг дор. Цэс, эрхийн дүрэм өөрчлөгдвөл ЭНД давхар засна:
 * @see src/layout/navigation.ts — цэс ба аймгийн хязгаарлалт
 * @see src/lib/permissions.ts — эрхийн дүрэм
 *
 * Оролцогч бүр ЗӨВХӨН шууд оролцдог use case-доо тэмдэглэгдэнэ. Өвлөлт
 * (Супер ⊃ Админ ⊃ Гишүүн, Харуул ⊃ Аймгийн гишүүн) диаграмд тайлбараар л
 * гарна — эс бөгөөс админ бүх хайрцгийг гэрэлтүүлээд утгагүй болно.
 */

export type ActorId =
  | "guest"
  | "member"
  | "aimag"
  | "guard"
  | "notifier"
  | "admin"
  | "super"
  | "external";

export type Actor = {
  id: ActorId;
  label: string;
  /** Дүрсний доорх жижиг тайлбар (мөр тус бүр) */
  sub: string[];
  side: "left" | "right";
  color: string;
};

export type UseCase = { label: string; actors: ActorId[] };

export type UseCasePackage = {
  id: string;
  title: string;
  cases: UseCase[];
};

export const actors: Actor[] = [
  {
    id: "guest",
    label: "Зочин",
    sub: ["бүртгэлгүй хүн"],
    side: "left",
    color: "#94a3b8",
  },
  {
    id: "member",
    label: "Гишүүн",
    sub: ["идэвхтэй хэрэглэгч", "веб · PWA апп"],
    side: "left",
    color: "#4ade80",
  },
  {
    id: "aimag",
    label: "Аймгийн гишүүн",
    sub: ["Магтаал · Хангамж", "Агуу захирамж · Туслах", "Тахилт"],
    side: "left",
    color: "#60a5fa",
  },
  {
    id: "guard",
    label: "Харуулын аймаг",
    sub: ["бүх аймгийн төлөвлөгөө", "тушаал · Excel"],
    side: "left",
    color: "#2dd4bf",
  },
  {
    id: "notifier",
    label: "Мэдэгдэл илгээгч",
    sub: ["canNotify эрхтэй гишүүн"],
    side: "right",
    color: "#c084fc",
  },
  {
    id: "admin",
    label: "Админ",
    sub: ["хэрэглэгч · санхүү", "бүртгэл · хяналт"],
    side: "right",
    color: "#e0b341",
  },
  {
    id: "super",
    label: "Супер админ",
    sub: ["эрх олгох · нөөцлөлт"],
    side: "right",
    color: "#fb7185",
  },
  {
    id: "external",
    label: "Гадаад систем",
    sub: ["Firebase Auth · FCM", "PostgreSQL · Google Drive", "Банкны хуулга · OSM · Cron"],
    side: "right",
    color: "#a1a1aa",
  },
];

export const packages: UseCasePackage[] = [
  {
    id: "auth",
    title: "1. Нэвтрэлт, профайл",
    cases: [
      { label: "Бүртгүүлэх, зөвшөөрөл хүлээх", actors: ["guest", "external"] },
      { label: "Нэвтрэх, нууц үг сэргээх", actors: ["guest", "member", "external"] },
      { label: "Профайл, аймаг бөглөх", actors: ["member"] },
      { label: "Төхөөрөмж, сесс удирдах", actors: ["member"] },
      { label: "Апп (PWA) суулгах", actors: ["member"] },
    ],
  },
  {
    id: "home",
    title: "2. Нүүр, мэдэгдэл",
    cases: [
      { label: "Долоо хоногийн хуваарь харах", actors: ["member"] },
      { label: "Хуваарийн зураг оруулах", actors: ["admin"] },
      { label: "Push мэдэгдэл хүлээн авах", actors: ["member", "external"] },
      { label: "Санал хүсэлт илгээх, явц харах", actors: ["member"] },
      { label: "Санал хүсэлтийн төлөв солих", actors: ["admin"] },
    ],
  },
  {
    id: "tithe",
    title: "3. Санхүү · 1/10 ба өргөл",
    cases: [
      { label: "Өргөх данс хуулах", actors: ["member"] },
      { label: "Гүйлгээний утга үүсгэх", actors: ["member"] },
      { label: "Газрын 1/10 заавар харах", actors: ["member"] },
      { label: "Банкны хуулга (Excel) унших", actors: ["admin", "external"] },
      { label: "1/10, өргөлийг ангилах", actors: ["admin"] },
    ],
  },
  {
    id: "donation",
    title: "4. Хандив, Өглөг",
    cases: [
      { label: "Хандивын аян харах", actors: ["member"] },
      { label: "Хандив өргөснөө илгээх", actors: ["member"] },
      { label: "Өглөг цуглуулах / өгсөн", actors: ["member"] },
      { label: "Хандив батлах, мэдэгдэх", actors: ["admin", "external"] },
      { label: "Аян үүсгэх, онцлох, эрэмбэлэх", actors: ["admin"] },
    ],
  },
  {
    id: "plan",
    title: "5. Илчлэл, Төлөвлөгөө",
    cases: [
      { label: "Илчлэл нийтлэх, унших", actors: ["aimag", "guard"] },
      { label: "Аймгийн даалгавар хөтлөх", actors: ["aimag", "guard"] },
      { label: "Тушаал, дэд тушаал үүсгэх", actors: ["guard", "admin"] },
      { label: "Бүх аймгийн төлөвлөгөө харах", actors: ["guard"] },
      { label: "Бүртгэлийг Excel-ээр татах", actors: ["guard", "admin"] },
    ],
  },
  {
    id: "gospel",
    title: "6. Сайн мэдээ, Халамж",
    cases: [
      { label: "Сайн мэдээ хүргэсэн хүн бүртгэх", actors: ["aimag", "guard"] },
      { label: "Халамжийн өрх бүртгэх", actors: ["aimag", "guard"] },
      { label: "Үзүүлсэн тусламж тэмдэглэх", actors: ["aimag", "guard"] },
    ],
  },
  {
    id: "special",
    title: "7. Аймгийн тусгай модуль",
    cases: [
      { label: "Харуулын цэг, айлчлалын лог", actors: ["guard", "external"] },
      { label: "Эд хөрөнгө бүртгэх", actors: ["aimag"] },
      { label: "Ээлжийн хуваарь гаргах", actors: ["aimag"] },
      { label: "Хандивын хайрцгийн байршил", actors: ["aimag", "external"] },
    ],
  },
  {
    id: "supply",
    title: "8. Хангамж",
    cases: [
      { label: "Хангамж, төсөв бүртгэх", actors: ["admin"] },
      { label: "Нөөцийн орлого, зарлага", actors: ["admin"] },
      { label: "Сахилгажуулалт хөтлөх", actors: ["aimag", "admin"] },
    ],
  },
  {
    id: "tahilt",
    title: "9. Тахилт",
    cases: [
      { label: "Цуглаан: сургаал, үйл явдал", actors: ["aimag"] },
      { label: "Итгэгчид: том, өсвөр, хүүхэд", actors: ["aimag"] },
      { label: "Тахилтын тушаал", actors: ["aimag"] },
      { label: "Сургалт", actors: ["aimag"] },
    ],
  },
  {
    id: "notify",
    title: "10. Мэдэгдэл илгээх",
    cases: [
      { label: "Аймаг, бүлэгт мэдэгдэл илгээх", actors: ["notifier", "admin", "external"] },
      { label: "Мэдэгдэл товлох", actors: ["notifier", "admin"] },
      { label: "Товлосныг цагт нь илгээх", actors: ["external"] },
    ],
  },
  {
    id: "users",
    title: "11. Хэрэглэгчийн удирдлага",
    cases: [
      { label: "Бүртгэл батлах, хаах", actors: ["admin"] },
      { label: "Аймаг, дуудлага оноох", actors: ["admin"] },
      { label: "Мэдэгдэл илгээх эрх олгох", actors: ["admin"] },
      { label: "Хэрэглэгчийн тайлан, хүүхдийн бүртгэл", actors: ["admin"] },
      { label: "Хэрэглэгч, өгөгдөл устгах", actors: ["admin"] },
    ],
  },
  {
    id: "system",
    title: "12. Системийн удирдлага",
    cases: [
      { label: "Эрх (role) олгох, өөрчлөх", actors: ["super"] },
      { label: "Өгөгдлийн сангийн нөөц үүсгэх", actors: ["super", "external"] },
      { label: "Нөөцийг татах, Drive-д хадгалах", actors: ["super", "external"] },
      { label: "Сүүлчийн супер админыг хамгаалах", actors: ["super"] },
    ],
  },
];

/** Тухайн багцад оролцдог оролцогчид — actors-ийн дарааллаар */
export function packageActors(pkg: UseCasePackage): ActorId[] {
  const ids = new Set(pkg.cases.flatMap((c) => c.actors));
  return actors.filter((a) => ids.has(a.id)).map((a) => a.id);
}
