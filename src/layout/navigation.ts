import {
  Baby,
  Bell,
  BookOpen,
  Boxes,
  Church,
  Clapperboard,
  Coins,
  CalendarClock,
  ClipboardList,
  DatabaseBackup,
  Flame,
  Gavel,
  Gift,
  GraduationCap,
  HandCoins,
  HandHeart,
  HeartHandshake,
  IdCard,
  LayoutGrid,
  MapPin,
  MessageSquarePlus,
  Megaphone,
  Music2,
  Package,
  Scale,
  Shield,
  ShieldCheck,
  Tent,
  Crown,
  FolderKanban,
  ScrollText,
  Handshake,
  Users,
  UsersRound,
  Wallet,
  Warehouse,
  Wheat,
  Workflow,
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
 * Аймаг бүрийн "Илчлэл" цэс — аймгийн цэсийн ХАМГИЙН ЭХЭНД (Төлөвлөгөөний
 * өмнө). Нийтлэл нь аймаг бүрт тусдаа; Facebook-ийн нийтлэл шиг бичнэ.
 */
function revelationMenu(aimag: string): NavItem {
  return { name: "Илчлэл", path: `/aimag/${aimag}/revelation`, icon: Megaphone };
}

/**
 * Аймаг бүрийн "Төлөвлөгөө" цэс — үргэлж аймгийн цэсийн ЭХЭНД байрлана.
 * Тушаал, даалгавар нь нэг сан; аймаг бүр өөрийнхөө тушаалыг л харна, харин
 * Харуулын аймгийнх бүх аймгийн төлөвлөгөөг харна (`canSeeAllPlans`).
 */
function planMenu(aimag: string): NavItem {
  return { name: "Төлөвлөгөө", path: `/aimag/${aimag}/plan`, icon: ClipboardList };
}

/**
 * «Сайн мэдээ» — Харуул, Магтаал, Агуу захирамжийн аймагт. Бүртгэл нь нэг
 * л сан (@see data/gospelOptions.ts), зөвхөн зам нь тухайн аймгийнх.
 */
function gospelMenu(aimag: string): NavItem {
  return { name: "Сайн мэдээ", path: `/aimag/${aimag}/gospel`, icon: BookOpen };
}

/**
 * «Халамж» — аймаг БҮРИЙН цэсийн төгсгөлд. Халамжийн бүртгэл нь бүх аймагт
 * нэг л сан (газрын зураг, тусламжийн түүх), зөвхөн зам нь тухайн аймгийнх.
 */
function welfareMenu(aimag: string): NavItem {
  return { name: "Халамж", path: `/aimag/${aimag}/tahilt/welfare`, icon: HandHeart };
}

/**
 * Үндсэн цэс — хажуугийн самбар болон breadcrumb хоёулаа эндээс уншина.
 *
 * Аймгийн цэсүүд нь profileOptions.aimags-ийн дараалалтай нийцнэ: тэнд заасан
 * дараалал нь UI-д ямар эрэмбээр гарахыг тодорхойлдог.
 */
export const navItems: NavItem[] = [
  { name: "Нүүр", path: "/", icon: LayoutGrid },
  {
    // Эрх олгосон хүнд л — profileOptions.aimags дахь "dut" харьяалалтай гишүүд
    // (ба админ). API нь ч шалгана (@see data/postOptions.ts RESTRICTED_BOARDS).
    name: "Д.У.Т",
    path: "/dut",
    icon: Flame,
    aimag: "dut",
  },
  {
    // Аймгуудтай адил үйлчлэлийн нэгж — profileOptions.aimags дахь "tahilt"
    // харьяалалтай гишүүд (ба админ) харна. Халамж нь аймгуудын Тахилт доорхтой
    // нэг л сан.
    name: "Тахилт",
    path: "/tahilt",
    icon: HandCoins,
    aimag: "tahilt",
    children: [
      { name: "Илчлэл", path: "/tahilt/revelation", icon: Megaphone },
      {
        name: "Тахилт дахь чуулган",
        path: "/tahilt/church",
        icon: Church,
        children: [
          // Сургаал, Амралтын өдрийн үйлчлэл, Үйл явдал нь хуудас доторх таб
          { name: "Цуглаан", path: "/tahilt/church/gathering", icon: UsersRound },
          // Насанд хүрэгсэд, Өсвөр, Хүүхэд нь хуудас доторх таб
          { name: "Итгэгчид", path: "/tahilt/church/believers", icon: Users },
        ],
      },
      // Бусад аймгийн Төлөвлөгөөнөөс тусдаа — өөрийн хүснэгттэй (tahilt_commands)
      { name: "Тушаал", path: "/tahilt/commands", icon: ClipboardList },
      { name: "Халамж", path: "/tahilt/welfare", icon: HandHeart },
      { name: "Сургалт", path: "/tahilt/training", icon: GraduationCap },
    ],
  },
  {
    // Аймгуудын дээр. «1/10 ба өргөл» нь бүгдэд — гишүүд өргөх данс, гүйлгээний
    // утгаа эндээс хуулна (хуулга уншдаг таб нь хуудас дотроо зөвхөн админд).
    // Хангамж, Хандив, Өглөг бүгдэд.
    name: "Санхүү",
    path: "/finance",
    icon: Wallet,
    children: [
      { name: "1/10 ба өргөл", path: "/finance/allocation", icon: Coins },
      { name: "Газрын 1/10", path: "/finance/land-tithe", icon: Wheat },
      // Цэс нь бүгдэд. Хуудас доторх табууд (@see SupplyTabs): Хангамжийн талаар —
      // бүгдэд, Чуулганы хангамж/төсөв — аймгийн гишүүдэд (админ бүгдийг).
      // Сахилгажуулалт нь Хангамжийн аймаг → Сахилгажуулалтын төлбөр рүү шилжсэн.
      { name: "Хангамж", path: "/finance/supply", icon: Package },
      { name: "Хандив", path: "/finance/donations", icon: Gift },
      { name: "Өглөг", path: "/finance/alms", icon: HandHeart },
    ],
  },
  {
    name: "Харуулын аймаг",
    path: "/aimag/guard",
    icon: Shield,
    aimag: "guard",
    // Харуулын «Төлөвлөгөө» нь «Тушаал» гэж нэрлэгдэнэ (бүх аймгийн тушаал,
    // даалгавар нэг самбарт); «Харуулын үүрэгт зогсох» — нийтлэлийн самбар
    children: [
      revelationMenu("guard"),
      { ...planMenu("guard"), name: "Тушаал" },
      { name: "Харуулын үүрэгт зогсох", path: "/aimag/guard/duty", icon: ShieldCheck },
      { name: "Газрын зургийн үйлчлэл", path: "/aimag/guard/map", icon: MapPin },
      gospelMenu("guard"),
      welfareMenu("guard"),
    ],
  },
  {
    name: "Магтаалын аймаг",
    path: "/aimag/praise",
    icon: Music2,
    aimag: "praise",
    // «Төлөвлөгөө» нь энд «Тушаал» гэж нэрлэгдэнэ; «Асрын үйлчлэл» — нийтлэлийн самбар
    children: [
      revelationMenu("praise"),
      { ...planMenu("praise"), name: "Тушаал" },
      { name: "Асрын үйлчлэл", path: "/aimag/praise/hall", icon: Tent },
      // Эд хөрөнгө — нэг бүртгэл, цэс бүр өөр ангиллаар шүүнэ (@see AssetRegistry ASSET_VIEWS)
      // Эд хөрөнгө — хоёр цэс, дотроо таб (@see AssetTabs). Нэг л бүртгэл.
      { name: "Эд хөрөнгийн ерөнхий бүртгэл", path: "/aimag/praise/assets", icon: Boxes },
      { name: "Агуулахын бүртгэл", path: "/aimag/praise/warehouse", icon: Warehouse },
      gospelMenu("praise"),
      welfareMenu("praise"),
    ],
  },
  {
    name: "Хангамжийн аймаг",
    path: "/aimag/supply",
    icon: Package,
    aimag: "supply",
    // Илчлэл, Тушаал, Хаанчлалын хангамж (нийтлэлийн самбар), Сахилгажуулалт
    children: [
      revelationMenu("supply"),
      { ...planMenu("supply"), name: "Тушаал" },
      { name: "Хаанчлалын хангамж", path: "/aimag/supply/kingdom", icon: Crown },
      {
        name: "Сахилгажуулалт",
        path: "/aimag/supply/discipline",
        icon: Scale,
      },
      welfareMenu("supply"),
    ],
  },
  {
    name: "Агуу захирамжийн аймаг",
    path: "/aimag/commission",
    icon: Gavel,
    aimag: "commission",
    // «Төлөвлөгөө» нь энд «Тушаал»; АЗ, ААХ-ийн үйлчлэл — нийтлэлийн самбар
    children: [
      revelationMenu("commission"),
      { ...planMenu("commission"), name: "Тушаал" },
      { name: "АЗ-ийн үйлчлэл", path: "/aimag/commission/az", icon: ScrollText },
      { name: "ААХ-ийн үйлчлэл", path: "/aimag/commission/aah", icon: Handshake },
      {
        name: "Хуваарь",
        path: "/aimag/commission/schedule",
        icon: CalendarClock,
      },
      gospelMenu("commission"),
      welfareMenu("commission"),
    ],
  },
  {
    name: "Туслах үйлчлэх аймаг",
    path: "/aimag/service",
    icon: HeartHandshake,
    aimag: "service",
    // Илчлэл, Тушаал, Туслах үйлчлэлүүд, Төслүүд, Медиа (нийтлэлийн самбар), Сайн мэдээ
    children: [
      revelationMenu("service"),
      { ...planMenu("service"), name: "Тушаал" },
      { name: "Туслах үйлчлэлүүд", path: "/aimag/service/services", icon: Handshake },
      { name: "Төслүүд", path: "/aimag/service/projects", icon: FolderKanban },
      { name: "Медиа", path: "/aimag/service/media", icon: Clapperboard },
      {
        name: "Хандивын хайрцаг",
        path: "/aimag/service/donations",
        icon: Gift,
      },
      gospelMenu("service"),
      welfareMenu("service"),
    ],
  },
  { name: "Мэдэгдэл илгээх", path: "/admin/notifications", icon: Bell, notifierOnly: true },
  { name: "Хэрэглэгчид", path: "/users", icon: Users, adminOnly: true },
  {
    name: "Хэрэглэгчийн мэдээлэл",
    path: "/users/directory",
    icon: IdCard,
    adminOnly: true,
  },
  { name: "Хүүхдийн бүртгэл", path: "/users/children", icon: Baby, adminOnly: true },
  {
    name: "Нөөцлөлт",
    path: "/backup",
    icon: DatabaseBackup,
    superOnly: true,
  },
  // Хамгийн доор — бүх хэрэглэгчид нээлттэй
  { name: "Системийн use case", path: "/use-case", icon: Workflow },
  { name: "Санал хүсэлт", path: "/feedback", icon: MessageSquarePlus },
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
 * Эцэг цэс өөрөө хуудасгүй тул хүүхдүүд нь орно. "Нүүр" өөрөө орохгүй.
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

  return extra ? extraTitles[extra] : "Нүүр";
}
