import {
  Bell,
  BookOpen,
  Boxes,
  Church,
  ClipboardList,
  HandCoins,
  HandHeart,
  HeartHandshake,
  LayoutGrid,
  MapPin,
  Megaphone,
  Music2,
  Package,
  Shield,
  ShoppingCart,
  Sprout,
  Tent,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { isAdminRole } from "@/lib/permissions";

export type NavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
  /** Зөвхөн админ эрхтэй хэрэглэгчид харагдах цэс */
  adminOnly?: boolean;
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
  { name: "Ажлууд", path: "/tasks", icon: ClipboardList },
  { name: "Санхүү", path: "/transactions", icon: Wallet },
  { name: "Гарын авлага", path: "/handbook", icon: BookOpen },
  {
    name: "Харуулын аймаг",
    path: "/aimag/guard",
    aimag: "guard",
    icon: Shield,
    children: [{ name: "Газрын зураг", path: "/map", icon: MapPin }],
  },
  {
    name: "Магтаалын аймаг",
    path: "/aimag/praise",
    aimag: "praise",
    icon: Music2,
    children: [
      { name: "Эд хөрөнгө бүртгэл", path: "/aimag/praise/assets", icon: Boxes },
    ],
  },
  {
    name: "Хангамжийн аймаг",
    path: "/aimag/supply",
    aimag: "supply",
    icon: Package,
    children: [
      {
        name: "Худалдан авах жагсаалт",
        path: "/aimag/supply/purchases",
        icon: ShoppingCart,
      },
    ],
  },
  {
    name: "Агуу захирамжийн аймаг",
    path: "/aimag/commission",
    aimag: "commission",
    icon: Megaphone,
    children: [
      { name: "Мод услах", path: "/aimag/commission/watering", icon: Sprout },
      {
        name: "Дулаанхаан",
        path: "/aimag/commission/dulaankhaan",
        icon: Tent,
      },
    ],
  },
  {
    name: "Туслах үйлчлэх аймаг",
    path: "/aimag/service",
    aimag: "service",
    icon: HeartHandshake,
    children: [
      {
        name: "Хандивын хайрцаг",
        path: "/aimag/service/donations",
        icon: HandCoins,
      },
    ],
  },
  {
    name: "Тахилт",
    path: "/tahilt",
    aimag: "tahilt",
    icon: Church,
    children: [
      {
        name: "Халамжийн үйлчлэл",
        path: "/tahilt/welfare",
        icon: HandHeart,
      },
    ],
  },
  { name: "Мэдэгдэл илгээх", path: "/admin/notifications", icon: Bell, adminOnly: true },
  { name: "Хэрэглэгчид", path: "/users", icon: Users, adminOnly: true },
];

/** Цэс харах эрхийг шалгахад хэрэгтэй хэрэглэгчийн товч мэдээлэл */
export type NavViewer = {
  role?: string;
  /** Харьяалагдах аймгуудын түлхүүр */
  aimags?: string[];
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
  if (isAdminRole(viewer.role)) return true;
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

  for (const item of navItems) {
    if (item.path === "/") continue;

    const entries: Shortcut[] = item.children?.length
      ? item.children.map((child) => ({
          ...child,
          group: item.name,
          // Хүүхэд нь эцгийнхээ хязгаарлалтыг өвлөнө
          adminOnly: item.adminOnly || child.adminOnly,
          aimag: child.aimag ?? item.aimag,
        }))
      : [item];

    for (const entry of entries) {
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
  // Цэснээс хассан ч зам нь хэвээр — бүх аймгийн нэгдсэн бүртгэл, тооллого
  // энд л удирдагдана.
  "/assets": "Эд хөрөнгө",
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

  for (const item of navItems) {
    for (const entry of item.children ? [item, ...item.children] : [item]) {
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
