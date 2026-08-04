/**
 * Эрхийн дүрэм — сервер (API route) ба клиент (UI) хоёул ЭНЭ файлыг уншина.
 *
 * UI дээрх disabled төлөв нь зөвхөн тав тухын үүрэгтэй; жинхэнэ шийдвэрийг
 * /api/users/[uid] route энэ л функцүүдээр гаргана.
 */

export type UserRole = "super" | "admin" | "user";
/** pending — админы зөвшөөрөл хүлээж буй, blocked — түр хаагдсан */
export type UserStatus = "active" | "pending" | "blocked";

/** Том тоо = өндөр эрх. Харьцуулалт бүр энэ шатлалаар явна. */
export const roleRank: Record<UserRole, number> = {
  super: 3,
  admin: 2,
  user: 1,
};

export const isAdminRole = (role?: string | null): boolean =>
  role === "admin" || role === "super";

export const isSuperRole = (role?: string | null): boolean => role === "super";

export const asRole = (role?: string | null): UserRole =>
  role === "super" || role === "admin" ? role : "user";

/** actor нь target-аас ЧАНД дээгүүр эрхтэй эсэх (ижил эрх → false). */
export const outranks = (actor: UserRole, target: UserRole): boolean =>
  roleRank[actor] > roleRank[target];

/** Шийдвэр гаргахад хэрэгтэй хамгийн бага мэдээлэл */
export type Actor = { uid: string; role: UserRole };
export type Target = { uid: string; role: UserRole };

/**
 * actor нь target дээр үйлдэл хийж болох эсэх (өөрийг нь тусад нь шалгана).
 *
 * Супер админ бол оройн эрх тул хэнийг ч удирдана — түүнийг барих ганц
 * хамгаалалт нь `keepsLastSuper`. Админ зөвхөн өөрөөсөө доогуурыг удирдана,
 * ингэснээр админууд бие биенээ хааж чадахгүй.
 */
export const canActOn = (actor: Actor, target: Target): boolean =>
  isSuperRole(actor.role) || outranks(actor.role, target.role);

export type Permission =
  | { allowed: true }
  | { allowed: false; reason: string };

const allow: Permission = { allowed: true };
const deny = (reason: string): Permission => ({ allowed: false, reason });

/**
 * Эрх (role) олгох — ЗӨВХӨН супер админ.
 *
 * Энгийн админд эрх олгох эрх өгвөл тэрээр хамтрагчаа super болгоод дамжуулан
 * өөрийгөө дэвшүүлэх боломжтой болно.
 */
export function canAssignRoles(actor: Actor, target: Target): Permission {
  if (!isSuperRole(actor.role)) {
    return deny("Эрх олгох, өөрчлөх нь зөвхөн супер админд боломжтой.");
  }

  if (actor.uid === target.uid) {
    return deny(
      "Өөрийн эрхийг өөрчлөх боломжгүй. Өөр супер админаар дамжуулна уу."
    );
  }

  return allow;
}

/** Тодорхой эрх рүү шилжүүлэх боломжтой эсэх. */
export function canChangeRole(
  actor: Actor,
  target: Target,
  nextRole: UserRole
): Permission {
  const base = canAssignRoles(actor, target);
  if (!base.allowed) return base;

  if (target.role === nextRole) {
    return deny("Хэрэглэгч аль хэдийн энэ эрхтэй байна.");
  }

  return allow;
}

/**
 * Төлөв солих (зөвшөөрөх / хаах) — админ ба супер админ хийнэ, гэхдээ зөвхөн
 * өөрөөсөө доогуур эрхтэй хэрэглэгч дээр. Ингэснээр админ нь супер админыг,
 * эсвэл өөр нэг админыг хааж чадахгүй.
 */
export function canChangeStatus(actor: Actor, target: Target): Permission {
  if (!isAdminRole(actor.role)) {
    return deny("Зөвхөн админ хийх боломжтой үйлдэл.");
  }

  if (actor.uid === target.uid) {
    return deny("Өөрийн бүртгэлийн төлөвийг өөрчлөх боломжгүй.");
  }

  if (!canActOn(actor, target)) {
    return deny(
      "Өөртэй чинь ижил буюу дээгүүр эрхтэй хэрэглэгчийг өөрчлөх боломжгүй."
    );
  }

  return allow;
}

/** Хороо оноох — төлөвтэй ижил шатлал, гэхдээ өөрийнхөө хороог зөвшөөрнө. */
export function canChangeKhoroo(actor: Actor, target: Target): Permission {
  if (!isAdminRole(actor.role)) {
    return deny("Зөвхөн админ хийх боломжтой үйлдэл.");
  }

  if (actor.uid === target.uid) return allow;

  if (!canActOn(actor, target)) {
    return deny(
      "Өөртэй чинь ижил буюу дээгүүр эрхтэй хэрэглэгчийг өөрчлөх боломжгүй."
    );
  }

  return allow;
}

/**
 * Систем эзэнгүй үлдэхээс сэргийлнэ — идэвхтэй супер админ хэзээ ч 0 болж
 * болохгүй. `activeSuperCount` нь өөрчлөлт хийхээс ӨМНӨХ тоо.
 */
export function keepsLastSuper(
  target: Target,
  activeSuperCount: number,
  change: { nextRole?: UserRole; nextStatus?: UserStatus }
): Permission {
  if (target.role !== "super" || activeSuperCount > 1) return allow;

  if (change.nextRole !== undefined && change.nextRole !== "super") {
    return deny("Системд дор хаяж нэг идэвхтэй супер админ байх ёстой.");
  }

  if (change.nextStatus !== undefined && change.nextStatus !== "active") {
    return deny("Системд дор хаяж нэг идэвхтэй супер админ байх ёстой.");
  }

  return allow;
}

export const roleLabels: Record<UserRole, string> = {
  super: "Супер админ",
  admin: "Админ",
  user: "Хэрэглэгч",
};

export const roleDescriptions: Record<UserRole, string> = {
  super:
    "Бүх эрх — хэрэглэгчдэд эрх олгох, бүртгэл зөвшөөрөх, хаах.",
  admin:
    "Бүртгэл зөвшөөрөх, хаах, хороо оноох. Эрх олгох боломжгүй.",
  user: "Өөрийн мэдээлэл, үндсэн хуудсуудад хандана.",
};

export const statusLabels: Record<UserStatus, string> = {
  active: "Идэвхтэй",
  pending: "Хүлээгдэж буй",
  blocked: "Хаагдсан",
};
