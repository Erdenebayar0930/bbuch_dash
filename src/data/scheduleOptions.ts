/**
 * Ээлжийн хуваарийн төрлүүд — сервер (шалгалт) ба клиент (UI) хоёул эндээс
 * уншина. Түлхүүр нь баазад бичигдэх утга тул шошгыг өөрчлөхөд өгөгдөл
 * хөндөгдөхгүй.
 *
 * Шинэ хуваарь нэмэхэд энд нэг мөр нэмээд хуудас үүсгэхэд хангалттай —
 * хүснэгт, API, UI бүгд хуваалцсан.
 */

export type ScheduleKind = "watering" | "dulaankhaan" | "care";

export const scheduleKinds: ScheduleKind[] = ["watering", "dulaankhaan", "care"];

/** Агуу захирамжийн «Хуваарь» хуудасны табууд — асрын хуваарь Магтаалынх */
export const commissionScheduleKinds: ScheduleKind[] = ["watering", "dulaankhaan"];

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
  /** Харах эрхтэй аймаг (profileOptions.aimags) — API нь `requireAimag`-аар шалгана */
  aimag: string;
};

export const scheduleConfigs: Record<ScheduleKind, ScheduleConfig> = {
  watering: {
    label: "Мод услах",
    areaLabel: "Талбай",
    areaPlaceholder: "Жишээ нь: Урд талбай",
    doneLabel: "Услсан",
    path: "/aimag/commission/watering",
    aimag: "commission",
  },
  dulaankhaan: {
    label: "Дулаанхаан",
    areaLabel: "Ажил",
    areaPlaceholder: "Жишээ нь: Айлчлал, айл эргэх",
    doneLabel: "Гүйцэтгэсэн",
    path: "/aimag/commission/dulaankhaan",
    aimag: "commission",
  },
  care: {
    label: "Асрын үйлчлэлийн хуваарь",
    areaLabel: "Үйлчлэл",
    areaPlaceholder: "Жишээ нь: Асар цэвэрлэх, тохижуулах",
    doneLabel: "Гүйцэтгэсэн",
    path: "/aimag/praise/hall",
    aimag: "praise",
  },
};

export const isScheduleKind = (value: unknown): value is ScheduleKind =>
  typeof value === "string" && scheduleKinds.includes(value as ScheduleKind);