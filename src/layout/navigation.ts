import {
  Bell,
  Boxes,
  FileText,
  FolderClosed,
  LayoutGrid,
  MapPin,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
  /** Зөвхөн админ эрхтэй хэрэглэгчид харагдах цэс */
  adminOnly?: boolean;
};

/** Үндсэн цэс — хажуугийн самбар болон breadcrumb хоёулаа эндээс уншина. */
export const navItems: NavItem[] = [
  { name: "Хянах самбар", path: "/", icon: LayoutGrid },
  { name: "Орлого / Зарлага", path: "/transactions", icon: TrendingUp },
  { name: "Хугарлын цэг", path: "/breakeven", icon: Target },
  { name: "Барааны дүн шинжилгээ", path: "/inventory", icon: Boxes },
  { name: "AI Дүн шинжилгээ", path: "/ai-analysis", icon: Sparkles },
  { name: "Тайлан", path: "/reports", icon: FileText },
  { name: "Газрын зураг", path: "/map", icon: MapPin },
  { name: "Захиргааны баримт", path: "/documents", icon: FolderClosed },
  { name: "Мэдэгдэл илгээх", path: "/admin/notifications", icon: Bell, adminOnly: true },
  { name: "Хэрэглэгчид", path: "/users", icon: Users, adminOnly: true },
];

/** Цэсэнд байхгүй ч breadcrumb-д гарах хуудсууд. */
const extraTitles: Record<string, string> = {
  "/settings": "Тохиргоо",
  "/profile": "Профайл",
  "/notifications": "Мэдэгдэл",
};

/** Замд тохирох хуудасны нэрийг буцаана. */
export function getPageTitle(pathname: string): string {
  const match = navItems.find((item) =>
    item.path === "/" ? pathname === "/" : pathname.startsWith(item.path)
  );

  if (match) return match.name;

  const extra = Object.keys(extraTitles).find((path) =>
    pathname.startsWith(path)
  );

  return extra ? extraTitles[extra] : "Хянах самбар";
}
