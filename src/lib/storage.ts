"use client";

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  uploadBytesResumable,
} from "firebase/storage";

import { MAX_POST_IMAGE_BYTES, MAX_POST_VIDEO_BYTES } from "@/data/postOptions";

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

// ---------------------------------------------------------------------------
// Хандивын хайрцгийн эргэлтийн зураг — нэг эргэлтэд олон файл
// ---------------------------------------------------------------------------

/** Эргэлтийн зургийн дээд хэмжээ — storage.rules-тэй ижил байлгана */
export const MAX_VISIT_PHOTO_BYTES = 10 * 1024 * 1024;

/** Хайрцгийн эргэлтийн зургийг байршуулна (зөвхөн идэвхтэй админ). */
export async function uploadVisitPhoto(
  boxId: string,
  file: File
): Promise<UploadedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Зөвхөн зураг оруулах боломжтой.");
  }
  if (file.size > MAX_VISIT_PHOTO_BYTES) {
    throw new Error("Зургийн хэмжээ 10MB-аас хэтэрч болохгүй.");
  }

  const path = `donation_box_visits/${boxId}/${crypto.randomUUID()}.${extensionOf(file)}`;
  const snapshot = await uploadBytes(ref(storage, path), file, {
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

// ---------------------------------------------------------------------------
// Санал хүсэлтийн зураг — хэрэглэгч бүр өөрийн хавтас руу
// ---------------------------------------------------------------------------

/** Санал хүсэлтийн зургийн дээд хэмжээ — storage.rules-тэй ижил байлгана */
export const MAX_FEEDBACK_IMAGE_BYTES = 10 * 1024 * 1024;

/** Санал хүсэлтийн зургийг `feedback/{uid}/` руу байршуулна. */
export async function uploadFeedbackImage(
  uid: string,
  file: File
): Promise<UploadedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Зөвхөн зураг оруулах боломжтой.");
  }
  if (file.size > MAX_FEEDBACK_IMAGE_BYTES) {
    throw new Error("Зургийн хэмжээ 10MB-аас хэтэрч болохгүй.");
  }

  const path = `feedback/${uid}/${crypto.randomUUID()}.${extensionOf(file)}`;
  const snapshot = await uploadBytes(ref(storage, path), file, {
    contentType: file.type,
    cacheControl: "public, max-age=31536000",
  });

  return { url: await getDownloadURL(snapshot.ref), path };
}

/** Санал хүсэлтийн зургийг устгана. Байхгүй байсан ч алдаа шидэхгүй. */
export async function deleteFeedbackImage(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "storage/object-not-found") throw error;
  }
}

// ---------------------------------------------------------------------------
// «Сайн мэдээ» бүртгэлийн зураг — бүртгэж буй хэрэглэгчийн хавтас руу
// ---------------------------------------------------------------------------

/** Бүртгэлийн зургийг `gospel/{uid}/` руу байршуулна. */
export async function uploadGospelPhoto(
  uid: string,
  file: File
): Promise<UploadedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Зөвхөн зураг оруулах боломжтой.");
  }
  if (file.size > MAX_FEEDBACK_IMAGE_BYTES) {
    throw new Error("Зургийн хэмжээ 10MB-аас хэтэрч болохгүй.");
  }

  const path = `gospel/${uid}/${crypto.randomUUID()}.${extensionOf(file)}`;
  const snapshot = await uploadBytes(ref(storage, path), file, {
    contentType: file.type,
    cacheControl: "public, max-age=31536000",
  });

  return { url: await getDownloadURL(snapshot.ref), path };
}

/**
 * Бүртгэлийн зургийг устгана. Байхгүй эсвэл эрхгүй бол чимээгүй алгасна —
 * бүртгэл аль хэдийн хадгалагдсан тул үлдсэн файл нь зөвхөн хог.
 */
export async function deleteGospelPhoto(path: string): Promise<void> {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    console.warn("Сайн мэдээний зургийг устгаж чадсангүй:", error);
  }
}

// ---------------------------------------------------------------------------
// «Илчлэл» нийтлэлийн зураг — бичсэн хүний хавтас руу
// ---------------------------------------------------------------------------

/** Нийтлэлийн зургийг `revelations/{uid}/` руу байршуулна. */
export async function uploadRevelationImage(
  uid: string,
  file: File
): Promise<UploadedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Зөвхөн зураг оруулах боломжтой.");
  }
  if (file.size > MAX_FEEDBACK_IMAGE_BYTES) {
    throw new Error("Зургийн хэмжээ 10MB-аас хэтэрч болохгүй.");
  }

  const path = `revelations/${uid}/${crypto.randomUUID()}.${extensionOf(file)}`;
  const snapshot = await uploadBytes(ref(storage, path), file, {
    contentType: file.type,
    cacheControl: "public, max-age=31536000",
  });

  return { url: await getDownloadURL(snapshot.ref), path };
}

/** Нийтлэлийн зургийг устгана. Байхгүй/эрхгүй бол чимээгүй алгасна. */
export async function deleteRevelationImage(path: string): Promise<void> {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    console.warn("Илчлэлийн зургийг устгаж чадсангүй:", error);
  }
}

// ---------------------------------------------------------------------------
// Нүүр хуудасны нийтлэлийн зураг/видео — бичсэн хүний хавтас руу
// ---------------------------------------------------------------------------

export type UploadedPostMedia = UploadedImage & { kind: "image" | "video" };

/**
 * Нийтлэлийн файлыг `posts/{uid}/` руу байршуулна. Видео том байж болох тул
 * resumable-аар илгээж, явцыг `onProgress`-оор (0–1) мэдээлнэ.
 */
export async function uploadPostMedia(
  uid: string,
  file: File,
  onProgress?: (fraction: number) => void
): Promise<UploadedPostMedia> {
  const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;

  if (!kind) throw new Error("Зөвхөн зураг эсвэл видео оруулах боломжтой.");
  if (kind === "image" && file.size > MAX_POST_IMAGE_BYTES) {
    throw new Error("Зургийн хэмжээ 10MB-аас хэтэрч болохгүй.");
  }
  if (kind === "video" && file.size > MAX_POST_VIDEO_BYTES) {
    throw new Error("Видеоны хэмжээ 100MB-аас хэтэрч болохгүй.");
  }

  const fallback = kind === "video" ? "mp4" : "jpg";
  const match = /\.([a-zA-Z0-9]{1,5})$/.exec(file.name);
  const path = `posts/${uid}/${crypto.randomUUID()}.${match ? match[1].toLowerCase() : fallback}`;

  const task = uploadBytesResumable(ref(storage, path), file, {
    contentType: file.type,
    cacheControl: "public, max-age=31536000",
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => onProgress?.(snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0),
      reject,
      () => resolve()
    );
  });

  return { kind, url: await getDownloadURL(task.snapshot.ref), path };
}

/** Нийтлэлийн файлыг устгана. Байхгүй/эрхгүй бол чимээгүй алгасна. */
export async function deletePostMedia(path: string): Promise<void> {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    console.warn("Нийтлэлийн файлыг устгаж чадсангүй:", error);
  }
}
