"use client";

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";

import { apiFetch } from "./apiClient";
import { auth } from "./firebase";
import { asRole, type UserRole, type UserStatus } from "./permissions";

export type { UserRole, UserStatus };

export type AppUser = {
  uid: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  position: string;
  /** Firebase Storage дахь профайл зургийн URL — байхгүй бол хоосон мөр */
  photo_url: string;
  role: UserRole;
  status: UserStatus;
  /** Харьяалагдах хорооны дугаар — мэдэгдлийг хороогоор чиглүүлэхэд ашиглана */
  khoroo: number | null;
  createdAt: Date | null;
};

/** Postgres-ээс ирэх мөр (camelCase) */
type UserRow = {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  position: string;
  photoUrl: string | null;
  role: string;
  status: string;
  khoroo: number | null;
  createdAt: string | null;
};

/** API-аас ирсэн мөрийг апп дотор хэрэглэдэг хэлбэрт буулгана */
function toAppUser(row: UserRow): AppUser {
  return {
    uid: row.uid,
    email: row.email ?? "",
    first_name: row.firstName ?? "",
    last_name: row.lastName ?? "",
    phone: row.phone ?? "",
    position: row.position ?? "",
    photo_url: row.photoUrl ?? "",
    role: asRole(row.role),
    status: (row.status ?? "active") as UserStatus,
    khoroo: typeof row.khoroo === "number" ? row.khoroo : null,
    createdAt: row.createdAt ? new Date(row.createdAt) : null,
  };
}

/** Системд админ бүртгэгдсэн эсэх (нэвтрэхгүйгээр уншина). */
export async function hasAdmin(): Promise<boolean> {
  const data = await apiFetch<{ hasAdmin: boolean }>("/api/auth/register", {
    auth: false,
  });
  return data.hasAdmin;
}

export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
};

export type RegisterResult = {
  uid: string;
  role: UserRole;
  status: UserStatus;
  /** Энэ хэрэглэгч системийн анхны админ болсон эсэх */
  isFirstAdmin: boolean;
};

/**
 * Шинэ хэрэглэгч бүртгэнэ.
 *
 * Аутентикац Firebase Auth дээр үлдсэн — бүртгэл үүсгээд, түүний ID token-оор
 * /api/auth/register рүү хандаж Postgres дэх мөрийг үүсгэнэ. Эрх/төлөвийг
 * сервер тал шийднэ (анхны хэрэглэгч → super/active, бусад → user/pending).
 */
export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();

  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    input.password
  );
  const firebaseUser = credential.user;

  try {
    const result = await apiFetch<{
      user: UserRow;
      isFirstAdmin: boolean;
    }>("/api/auth/register", {
      method: "POST",
      body: { firstName, lastName, phone: input.phone?.trim() ?? "", email },
    });

    const displayName = [firstName, lastName].filter(Boolean).join(" ");
    if (displayName) {
      await updateProfile(firebaseUser, { displayName }).catch(() => {
        // Профайлын нэр бичигдэхгүй байсан ч бүртгэл амжилттай гэж үзнэ
      });
    }

    await sendEmailVerification(firebaseUser).catch((error) => {
      console.warn("Имэйл баталгаажуулах холбоос илгээхэд алдаа гарлаа:", error);
    });

    const user = toAppUser(result.user);

    return {
      uid: user.uid,
      role: user.role,
      status: user.status,
      isFirstAdmin: result.isFirstAdmin,
    };
  } catch (error) {
    // Postgres бичилт бүтэлгүйтвэл эзэнгүй auth бүртгэл үлдээхгүй
    await cleanupOrphanAuthUser(firebaseUser);
    throw error;
  }
}

async function cleanupOrphanAuthUser(firebaseUser: FirebaseUser) {
  try {
    await firebaseUser.delete();
  } catch (error) {
    console.error("Дутуу бүртгэлийг цэвэрлэж чадсангүй:", error);
  }
}

/** Нэвтэрсэн хэрэглэгчийн профайл (Postgres дэх мөр). */
export async function getCurrentUser(): Promise<AppUser | null> {
  const data = await apiFetch<{ user: UserRow | null }>("/api/users/me");
  return data.user ? toAppUser(data.user) : null;
}

/** Өөрийн профайлаа шинэчилнэ. */
export async function updateCurrentUser(patch: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  position?: string;
  /** Firebase Storage-ийн URL, эсвэл зургийг авахын тулд хоосон мөр */
  photoUrl?: string;
  khoroo?: number | null;
}): Promise<AppUser> {
  const data = await apiFetch<{ user: UserRow }>("/api/users/me", {
    method: "PATCH",
    body: patch,
  });
  return toAppUser(data.user);
}

/** Бүх хэрэглэгчийг жагсаана (зөвхөн админ уншиж чадна). */
export async function listUsers(): Promise<AppUser[]> {
  const data = await apiFetch<{ users: UserRow[] }>("/api/users");
  return data.users.map(toAppUser);
}

/** Хэрэглэгчийн эрхийг солино (зөвхөн админ). */
export async function setUserRole(uid: string, role: UserRole) {
  await apiFetch(`/api/users/${uid}`, { method: "PATCH", body: { role } });
}

/** Хэрэглэгчийн төлөвийг солино — зөвшөөрөх / блоклох (зөвхөн админ). */
export async function setUserStatus(uid: string, status: UserStatus) {
  await apiFetch(`/api/users/${uid}`, { method: "PATCH", body: { status } });
}

/** Хэрэглэгчийн харьяа хороог солино (зөвхөн админ). */
export async function setUserKhoroo(uid: string, khoroo: number | null) {
  await apiFetch(`/api/users/${uid}`, { method: "PATCH", body: { khoroo } });
}

/** Тухайн хорооны идэвхтэй хэрэглэгчид (жагсаалт, тооллого харуулахад). */
export async function listUsersByKhoroo(khoroo: number): Promise<AppUser[]> {
  const users = await listUsers();
  return users.filter(
    (user) => user.khoroo === khoroo && user.status === "active"
  );
}

export { roleLabels, roleDescriptions, statusLabels } from "./permissions";
