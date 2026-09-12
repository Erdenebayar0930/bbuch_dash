"use client";

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import { storage } from "./firebase";

/** Зөвшөөрөгдөх зургийн дээд хэмжээ — storage.rules-тэй ижил байлгана */
export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Профайлын зураг хэрэглэгч тутамд нэг замд хадгалагдана.
 * Дахин хуулах бүрд хуучин объект дарагдах тул bucket дотор хог үлдэхгүй.
 */
export function profilePhotoPath(uid: string) {
  return `profile_photos/${uid}/avatar.jpg`;
}

/**
 * Тайрсан зургийг Firebase Storage-д байршуулж, татах URL-ыг буцаана.
 * URL нь дарагдах бүрт шинэ token авдаг тул кэш хуучирахгүй.
 */
export async function uploadProfilePhoto(
  uid: string,
  blob: Blob
): Promise<string> {
  if (blob.size > MAX_PROFILE_PHOTO_BYTES) {
    throw new Error("Зургийн хэмжээ 5MB-аас хэтэрч болохгүй.");
  }

  const objectRef = ref(storage, profilePhotoPath(uid));
  const snapshot = await uploadBytes(objectRef, blob, {
    contentType: "image/jpeg",
    cacheControl: "public, max-age=31536000",
  });

  return getDownloadURL(snapshot.ref);
}

// ---------------------------------------------------------------------------
// Эд хөрөнгийн зураг — нэг хөрөнгөд олон файл
// ---------------------------------------------------------------------------

/** Эд хөрөнгийн зургийн дээд хэмжээ — storage.rules-тэй ижил байлгана */
export const MAX_ASSET_IMAGE_BYTES = 10 * 1024 * 1024;

/** Файлын нэрнээс өргөтгөлийг гаргана (зөвхөн үсэг, тоо) */
function extensionOf(file: File): string {
  const match = /\.([a-zA-Z0-9]{1,5})$/.exec(file.name);
  return match ? match[1].toLowerCase() : "jpg";
}

export type UploadedImage = {
  url: string;
  /** Storage доторх зам — устгахад хэрэгтэй */
  path: string;
};

/**
 * Эд хөрөнгийн зургийг байршуулна.
 *
 * Файл бүр өөрийн нэртэй тул нэг хөрөнгөд олон зураг зэрэг байрлана.
 * Нэрийг санамсаргүй үүсгэснээр ижил нэртэй файл бие биенээ дарахгүй.
 */
export async function uploadAssetImage(
  assetId: string,
  file: File
): Promise<UploadedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Зөвхөн зураг оруулах боломжтой.");
  }
  if (file.size > MAX_ASSET_IMAGE_BYTES) {
    throw new Error("Зургийн хэмжээ 10MB-аас хэтэрч болохгүй.");
  }

  const path = `assets/${assetId}/${crypto.randomUUID()}.${extensionOf(file)}`;
  const objectRef = ref(storage, path);

  const snapshot = await uploadBytes(objectRef, file, {
    contentType: file.type,
    cacheControl: "public, max-age=31536000",
  });

  return { url: await getDownloadURL(snapshot.ref), path };
}

/** Эд хөрөнгийн зургийн файлыг Storage-оос устгана. */
export async function deleteAssetImageFile(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "storage/object-not-found") throw error;
  }
}

/** Профайлын зургийг устгана. Байхгүй байсан ч алдаа шидэхгүй. */
export async function deleteProfilePhoto(uid: string): Promise<void> {
  try {
    await deleteObject(ref(storage, profilePhotoPath(uid)));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "storage/object-not-found") throw error;
  }
}

// ---------------------------------------------------------------------------
// Долоо хоногийн хуваарийн постер зураг — ганц зам, дахин байршуулахад дарна
// ---------------------------------------------------------------------------

/** Постер зургийн дээд хэмжээ — storage.rules-тэй ижил байлгана */
export const MAX_SCHEDULE_POSTER_BYTES = 10 * 1024 * 1024;

export function schedulePosterPath(file: File) {
  return `schedule_poster/poster.${extensionOf(file)}`;
}

/**
 * Долоо хоногийн хуваарийн постерыг Storage-д байршуулж, татах URL-ыг буцаана.
 * Зөвхөн админ дуудна (storage.rules дотор activeAdmin() шалгана).
 */
export async function uploadSchedulePoster(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Зөвхөн зураг оруулах боломжтой.");
  }
  if (file.size > MAX_SCHEDULE_POSTER_BYTES) {
    throw new Error("Зургийн хэмжээ 10MB-аас хэтэрч болохгүй.");
  }

  const objectRef = ref(storage, schedulePosterPath(file));
  const snapshot = await uploadBytes(objectRef, file, {
    contentType: file.type,
    cacheControl: "public, max-age=31536000",
  });

  return getDownloadURL(snapshot.ref);
}

// ---------------------------------------------------------------------------
// Гарын авлагын баримт — админ байршуулна, идэвхтэй хэрэглэгч бүр татна
// ---------------------------------------------------------------------------

/** Гарын авлагын файлын дээд хэмжээ — storage.rules-тэй ижил байлгана */
export const MAX_HANDBOOK_FILE_BYTES = 25 * 1024 * 1024;

/** Зөвшөөрөгдөх төрлүүд — заавар ихэвчлэн PDF/Word/зураг хэлбэртэй байдаг */
const ALLOWED_HANDBOOK_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export type UploadedFile = {
  url: string;
  /** Storage доторх зам — устгахад хэрэгтэй */
  path: string;
};

/**
 * Гарын авлагын баримтыг байршуулна (зөвхөн админ — storage.rules шалгана).
 * Файл бүр санамсаргүй нэртэй тул ижил нэртэй хоёр баримт зөрчилдөхгүй.
 */
export async function uploadHandbookFile(file: File): Promise<UploadedFile> {
  const isAllowedType =
    file.type.startsWith("image/") || ALLOWED_HANDBOOK_TYPES.includes(file.type);

  if (!isAllowedType) {
    throw new Error("PDF, Word, Excel эсвэл зураг файл оруулна уу.");
  }
  if (file.size > MAX_HANDBOOK_FILE_BYTES) {
    throw new Error("Файлын хэмжээ 25MB-аас хэтэрч болохгүй.");
  }

  const path = `handbook/${crypto.randomUUID()}.${extensionOf(file)}`;
  const objectRef = ref(storage, path);

  const snapshot = await uploadBytes(objectRef, file, {
    contentType: file.type,
    cacheControl: "public, max-age=31536000",
  });

  return { url: await getDownloadURL(snapshot.ref), path };
}

/** Гарын авлагын баримтыг Storage-оос устгана. */
export async function deleteHandbookFile(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "storage/object-not-found") throw error;
  }
}
