/**
 * Ээлжийн хуваарийн төрлүүд — сервер (шалгалт) ба клиент (UI) хоёул эндээс
 * уншина. Түлхүүр нь баазад бичигдэх утга тул шошгыг өөрчлөхөд өгөгдөл
 * хөндөгдөхгүй.
 *
 * Шинэ хуваарь нэмэхэд энд нэг мөр нэмээд хуудас үүсгэхэд хангалттай —
 * хүснэгт, API, UI бүгд хуваалцсан.
 */

export type ScheduleKind = "watering" | "dulaankhaan";

export const scheduleKinds: ScheduleKind[] = ["watering", "dulaankhaan"];

export type ScheduleConfig = {
  /** Хуудасны нэр */
  label: string;
  /** Дунд баганын гарчиг — хуваарь бүрт өөр утгатай */
  areaLabel: string;
  /** Тухайн баганын жишээ утга — маягтын placeholder */
  areaPlaceholder: string;
  /** Гүйцэтгэсэн гэж тэмдэглэсний дараах төлөвийн нэр */
  doneLabel: string;
  /** Мэдэгдэл дэх холбоос */
  path: string;
};

export const scheduleConfigs: Record<ScheduleKind, ScheduleConfig> = {
  watering: {
    label: "Мод услах",
    areaLabel: "Талбай",
    areaPlaceholder: "Жишээ нь: Урд талбай",
    doneLabel: "Услсан",
    path: "/aimag/commission/watering",
  },
  dulaankhaan: {
    label: "Дулаанхаан",
    areaLabel: "Ажил",
    areaPlaceholder: "Жишээ нь: Айлчлал, айл эргэх",
    doneLabel: "Гүйцэтгэсэн",
    path: "/aimag/commission/dulaankhaan",
  },
};

export const isScheduleKind = (value: unknown): value is ScheduleKind =>
  typeof value === "string" && scheduleKinds.includes(value as ScheduleKind);