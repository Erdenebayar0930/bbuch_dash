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

export type NavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
  /** Зөвхөн админ эрхтэй хэрэглэгчид харагдах цэс */
  adminOnly?: boolean;
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
  { name: "Газар байршил", path: "/map", icon: MapPin },
  {
    name: "Харуулын аймаг",
    path: "/aimag/guard",
    icon: Shield,
    children: [
      // Одоо байгаа газрын зургийн хуудсыг дахин ашиглана — хоёр цэс нэг зам
      { name: "Газрын зураг", path: "/map", icon: MapPin },
    ],
  },
  {
    name: "Магтаалын аймаг",
    path: "/aimag/praise",
    icon: Music2,
    children: [
      { name: "Эд хөрөнгө бүртгэл", path: "/aimag/praise/assets", icon: Boxes },
    ],
  },
  {
    name: "Хангамжийн аймаг",
    path: "/aimag/supply",
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
    // Тахилт нь аймаг биш, тусдаа үйлчлэлийн нэгж — profileOptions.aimags-д
    // нэмбэл мэдэгдлийн бүлэг ба хэрэглэгчийн харьяалал өөрчлөгдөнө
    name: "Тахилт",
    path: "/tahilt",
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
 * Нэг зам хоёр цэст орж болно (жишээ нь /map нь «Газар байршил» ба Харуулын
 * аймгийн «Газрын зураг» хоёулд). Ийм үед navItems дахь ЭХНИЙ нэр ялна —
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
