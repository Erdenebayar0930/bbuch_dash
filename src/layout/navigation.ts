import {
  Bell,
  Boxes,
  CalendarClock,
  ClipboardList,
  DatabaseBackup,
  Gavel,
  Gift,
  HandCoins,
  HandHeart,
  HeartHandshake,
  LayoutGrid,
  MapPin,
  Music2,
  Package,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";

import { canSendNotifications, isAdminRole, isSuperRole } from "@/lib/permissions";

export type NavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
  /** Зөвхөн админ эрхтэй хэрэглэгчид харагдах цэс */
  adminOnly?: boolean;
  /**
   * Зөвхөн мэдэгдэл илгээх эрхтэй хэрэглэгчид (админ ба `canNotify` эрхтэй
   * бусад хэрэглэгч) харагдах цэс — `adminOnly`-тай хамт ашиглахгүй.
   */
  notifierOnly?: boolean;
  /**
   * Зөвхөн СУПЕР админд. `adminOnly`-оос хатуу: энгийн админ ч харахгүй.
   * Өгөгдлийн сангийн бүрэн хуулбар авах зэрэг бүх мэдээлэлд хүрдэг үйлдэлд.
   */
  superOnly?: boolean;
  /**
   * profileOptions.aimags доторх түлхүүр. Заасан бол тухайн аймагт
   * харьяалагдах хэрэглэгчид л цэсийг харна; админ ба super бүгдийг харна.
   * Хүүхэд цэс эцгийнхээ түлхүүрийг өвлөнө.
   */
  aimag?: string;
  /**
   * Задардаг дэд цэс. Эцэг мөр нь өөрөө хуудасгүй байж болно — дарахад
   * задарна, хумигдсан (зөвхөн дүрстэй) горимд эхний хүүхэд рүү шилжинэ.
   */
  children?: NavItem[];
};

/**
 * Үндсэн цэс — хажуугийн самбар болон breadcrumb хоёулаа эндээс уншина.
 *
 * Аймгийн цэсүүд нь profileOptions.aimags-ийн дараалалтай нийцнэ: тэнд заасан
 * дараалал нь UI-д ямар эрэмбээр гарахыг тодорхойлдог.
 */
export const navItems: NavItem[] = [
  { name: "Үндсэн цэс", path: "/", icon: LayoutGrid },
  {
    name: "Харуулын аймаг",
    path: "/aimag/guard",
    icon: Shield,
    aimag: "guard",
    children: [
      { name: "Газрын зураг", path: "/aimag/guard/map", icon: MapPin },
      { name: "Тахилт", path: "/aimag/guard/tahilt", icon: HandCoins },
    ],
  },
  {
    name: "Магтаалын аймаг",
    path: "/aimag/praise",
    icon: Music2,
    aimag: "praise",
    children: [
      {
        name: "Эд хөрөнгө бүртгэл",
        path: "/aimag/praise/assets",
        icon: Boxes,
      },
      {
        name: "Тахилт",
        path: "/aimag/praise/tahilt",
        icon: HandCoins,
        children: [
          {
            name: "Халамж",
            path: "/aimag/praise/tahilt/welfare",
            icon: HandHeart,
          },
        ],
      },
    ],
  },
  {
    name: "Хангамжийн аймаг",
    path: "/aimag/supply",
    icon: Package,
    aimag: "supply",
    children: [
      { name: "Төлөвлөгөө", path: "/aimag/supply/plan", icon: ClipboardList },
      { name: "Тахилт", path: "/aimag/supply/tahilt", icon: HandCoins },
    ],
  },
  {
    name: "Агуу захирамжийн аймаг",
    path: "/aimag/commission",
    icon: Gavel,
    aimag: "commission",
    children: [
      {
        name: "Төлөвлөгөө",
        path: "/aimag/commission/plan",
        icon: ClipboardList,
      },
      {
        name: "Хуваарь",
        path: "/aimag/commission/schedule",
        icon: CalendarClock,
      },
      { name: "Тахилт", path: "/aimag/commission/tahilt", icon: HandCoins },
    ],
  },
  {
    name: "Туслах үйлчлэх аймаг",
    path: "/aimag/service",
    icon: HeartHandshake,
    aimag: "service",
    children: [
      { name: "Төлөвлөгөө", path: "/aimag/service/plan", icon: ClipboardList },
      {
        name: "Хандивын хайрцаг",
        path: "/aimag/service/donations",
        icon: Gift,
      },
      { name: "Тахилт", path: "/aimag/service/tahilt", icon: HandCoins },
    ],
  },
  { name: "Мэдэгдэл илгээх", path: "/admin/notifications", icon: Bell, notifierOnly: true },
  { name: "Хэрэглэгчид", path: "/users", icon: Users, adminOnly: true },
  {
    name: "Нөөцлөлт",
    path: "/backup",
    icon: DatabaseBackup,
    superOnly: true,
  },
];

/** Цэс харах эрхийг шалгахад хэрэгтэй хэрэглэгчийн товч мэдээлэл */
export type NavViewer = {
  role?: string;
  /** Харьяалагдах аймгуудын түлхүүр */
  aimags?: string[];
  /** Админ бус ч мэдэгдэл илгээх эрх авсан эсэх */
  canNotify?: boolean;
};

/**
 * Тухайн цэсийг энэ хэрэглэгч харах эсэх.
 *
 * Админ ба super БҮГДИЙГ харна — тэд бүх аймгийг хянадаг. Энгийн хэрэглэгч
 * зөвхөн өөрийн харьяалагдах аймгийн цэсийг харна; аймаггүй цэс (Ажлууд,
 * Санхүү, Тахилт гэх мэт) бүгдэд нээлттэй.
 *
 * ⚠ Энэ нь ЗӨВХӨН цэсийг нуудаг. Хуудсууд нь хаягаар нь орвол нээгдэнэ —
 * жинхэнэ хязгаарлалт хэрэгтэй бол хуудас ба API тал дээр нэмэлт шалгалт хийнэ.
 */
export function canSeeNavItem(item: NavItem, viewer: NavViewer): boolean {
  // Супер админы шалгалт нь бүхнээс ТҮРҮҮНД — доорх `isAdminRole` нь супер
  // админыг ч багтаадаг тул дараа нь шалгавал энгийн админд ил гарна.
  if (item.superOnly) return isSuperRole(viewer.role);
  if (isAdminRole(viewer.role)) return true;
  if (item.notifierOnly) return canSendNotifications(viewer.role, viewer.canNotify);
  if (item.adminOnly) return false;
  if (item.aimag && !(viewer.aimags ?? []).includes(item.aimag)) return false;
  return true;
}

/** Үндсэн цэсийн хурдан холбоос — эцэг цэс биш, очих хуудсууд нь */
export type Shortcut = NavItem & {
  /** Аймгийн дэд хуудас бол эцгийнх нь нэр */
  group?: string;
};

/**
 * Үндсэн хуудсанд гаргах холбоосууд.
 *
 * Эцэг цэс өөрөө хуудасгүй тул хүүхдүүд нь орно. "Үндсэн цэс" өөрөө орохгүй.
 * Нэг зам хоёр цэст орсон бол (жишээ нь /map) эхнийх нь ялна — картууд
 * давхардахгүй.
 */
export const shortcuts: Shortcut[] = (() => {
  const seen = new Map<string, Shortcut>();

  // Эцэг мөрийн хязгаарлалт болон нэрийг хүүхдэд нь (хэдийгээр хэдэн
  // үедээ ч байсан) дамжуулна — тэрхүү үед дэргэдэх "group" нь ХАМГИЙН
  // ДОТООД эцгийн нэр байна (жишээ нь Тахилт > Халамж — group нь "Тахилт").
  function collectLeaves(
    item: NavItem,
    parentGroup: string | undefined,
    inheritedAdminOnly: boolean | undefined,
    inheritedAimag: string | undefined
  ): Shortcut[] {
    const adminOnly = inheritedAdminOnly || item.adminOnly;
    const aimag = item.aimag ?? inheritedAimag;

    if (!item.children?.length) {
      return [{ ...item, group: parentGroup, adminOnly, aimag }];
    }

    return item.children.flatMap((child) =>
      collectLeaves(child, item.name, adminOnly, aimag)
    );
  }

  for (const item of navItems) {
    if (item.path === "/") continue;

    for (const entry of collectLeaves(item, undefined, undefined, undefined)) {
      if (!seen.has(entry.path)) seen.set(entry.path, entry);
    }
  }

  return [...seen.values()];
})();

/** Цэсэнд байхгүй ч breadcrumb-д гарах хуудсууд. */
const extraTitles: Record<string, string> = {
  "/settings": "Тохиргоо",
  "/profile": "Профайл",
  "/notifications": "Мэдэгдэл",
  // Цэсэнд байхгүй ч зам нь хэвээр байгаа "удахгүй" хуудсууд
  "/ai-analysis": "AI Дүн шинжилгээ",
  "/documents": "Захиргааны баримт",
  "/inventory": "Барааны дүн шинжилгээ",
  "/reports": "Тайлан",
};

/**
 * Эцэг ба хүүхэд цэсийг нэг жагсаалт болгож, замын уртаар буурахаар эрэмбэлнэ.
 * Ингэснээр /aimag/praise/assets нь эцэг цэсийнхээ биш өөрийн нэрийг өгнө.
 *
 * Нэг зам хоёр цэст орж болно. Ийм үед navItems дахь ЭХНИЙ нэр ялна —
 * breadcrumb санамсаргүй нэр сонгохгүй.
 */
const flatItems = (() => {
  const seen = new Map<string, NavItem>();

  function collectAll(item: NavItem): NavItem[] {
    return item.children?.length
      ? [item, ...item.children.flatMap(collectAll)]
      : [item];
  }

  for (const item of navItems) {
    for (const entry of collectAll(item)) {
      if (!seen.has(entry.path)) seen.set(entry.path, entry);
    }
  }

  return [...seen.values()].sort((a, b) => b.path.length - a.path.length);
})();

/** Замд тохирох хуудасны нэрийг буцаана. */
export function getPageTitle(pathname: string): string {
  const match = flatItems.find((item) =>
    item.path === "/" ? pathname === "/" : pathname.startsWith(item.path)
  );

  if (match) return match.name;

  const extra = Object.keys(extraTitles).find((path) =>
    pathname.startsWith(path)
  );

  return extra ? extraTitles[extra] : "Үндсэн цэс";
}
