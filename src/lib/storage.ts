"use client";

import { deleteObject, ref } from "firebase/storage";

import {
  MAX_POST_FILE_BYTES,
  MAX_POST_IMAGE_BYTES,
  MAX_POST_VIDEO_BYTES,
  POST_FILE_TYPES,
} from "@/data/postOptions";

import { apiFetch } from "./apiClient";
import { getDeviceId, getScreenSize } from "./deviceId";
import { auth, storage } from "./firebase";

/**
 * Файл байршуулах/устгах — ӨӨРИЙН СЕРВЕР дээр (`/api/files`, @see lib/api/fileStore.ts).
 *
 * Өмнө нь бүгд Firebase Storage-д хадгалагддаг байсан. Тэр үеийн файлууд
 * Firebase-д үлдсэн бөгөөд URL нь хэвээр ажиллана. Тиймээс устгахдаа хоёр
 * газраас хоёуланг нь оролдоно — аль нэгэнд нь байхгүй байх нь хэвийн.
 *
 * Эрх, хэмжээ, төрлийн шалгалтыг сервер хийнэ (storage.rules-ийг давтана);
 * энд байгаа шалгалт нь зөвхөн хэрэглэгчид түргэн хариу өгөх зорилготой.
 */

export type UploadedImage = {
  url: string;
  /** Хадгалсан зам — устгахад хэрэгтэй */
  path: string;
};

export type UploadedFile = UploadedImage;

/** Нэвтэрсэн хэрэглэгчийн толгойнууд — apiFetch-тэй ижил */
async function authHeaders(): Promise<Record<string, string>> {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error("Нэвтэрсэн байх шаардлагатай.");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${await user.getIdToken()}`,
    "X-Device-Id": getDeviceId(),
  };
  const screenSize = getScreenSize();
  if (screenSize) headers["X-Screen-Size"] = screenSize;
  return headers;
}

/**
 * Файлыг сервер рүү илгээнэ. fetch нь байршуулалтын явцыг мэдээлдэггүй тул
 * XMLHttpRequest ашиглана (видео удаан байршдаг — явцын мөр хэрэгтэй).
 */
async function uploadToServer(
  scope: string,
  file: Blob,
  options: { key?: string; onProgress?: (fraction: number) => void } = {}
): Promise<UploadedImage> {
  const headers = await authHeaders();
  const params = new URLSearchParams({ scope });
  if (options.key) params.set("key", options.key);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/files?${params.toString()}`);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new Error("Сервертэй холбогдож чадсангүй. Холболтоо шалгана уу."));
    xhr.onload = () => {
      let payload: { url?: string; path?: string; error?: string } = {};
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        // Nginx-ийн HTML алдааны хуудас г.м.
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload.url && payload.path) {
        resolve({ url: payload.url, path: payload.path });
      } else if (xhr.status === 413) {
        reject(new Error(payload.error ?? "Файлын хэмжээ хэтэрсэн байна."));
      } else {
        reject(new Error(payload.error ?? "Файл байршуулахад алдаа гарлаа."));
      }
    };
    xhr.send(file);
  });
}

/** Сервер дээрээс устгана; Firebase-д үлдсэн хуучин файл бол тэндээс ч. */
async function removeEverywhere(path: string): Promise<void> {
  await apiFetch(`/api/files?path=${encodeURIComponent(path)}`, { method: "DELETE" });
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    const code = (error as { code?: string }).code;
    // Шинэ файл Firebase-д байхгүй — хэвийн
    if (code !== "storage/object-not-found" && code !== "storage/unauthorized") {
      console.warn("Firebase дахь хуучин файлыг устгаж чадсангүй:", error);
    }
  }
}

/** Чимээгүй устгал — үлдсэн файл нь зөвхөн хог тул хэрэглэгчийн үйлдлийг таслахгүй */
async function removeQuietly(path: string, label: string): Promise<void> {
  if (!path) return;
  try {
    await removeEverywhere(path);
  } catch (error) {
    console.warn(`${label} устгаж чадсангүй:`, error);
  }
}

function requireImage(file: Blob, maxBytes: number) {
  if (!file.type.startsWith("image/")) throw new Error("Зөвхөн зураг оруулах боломжтой.");
  if (file.size > maxBytes) {
    throw new Error(`Зургийн хэмжээ ${Math.round(maxBytes / (1024 * 1024))}MB-аас хэтэрч болохгүй.`);
  }
}

// ---------------------------------------------------------------------------
// Профайлын зураг — хэрэглэгч тутамд нэг (шинэ нь хуучныг сервер дээр сольно)
// ---------------------------------------------------------------------------

export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;

/** Firebase үеийн профайлын зургийн зам — хуучныг цэвэрлэхэд л хэрэгтэй */
export function profilePhotoPath(uid: string) {
  return `profile_photos/${uid}/avatar.jpg`;
}

/** Тайрсан зургийг байршуулж URL-ыг буцаана. */
export async function uploadProfilePhoto(_uid: string, blob: Blob): Promise<string> {
  // Тайрагч нь JPEG гаргадаг; төрөлгүй Blob ирвэл JPEG гэж тэмдэглэнэ
  const file = blob.type ? blob : new Blob([blob], { type: "image/jpeg" });
  requireImage(file, MAX_PROFILE_PHOTO_BYTES);
  return (await uploadToServer("profile_photos", file)).url;
}

/** Профайлын зургийг устгана. Байхгүй байсан ч алдаа шидэхгүй. */
export async function deleteProfilePhoto(uid: string): Promise<void> {
  await apiFetch("/api/files?scope=profile_photos", { method: "DELETE" });
  try {
    await deleteObject(ref(storage, profilePhotoPath(uid)));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "storage/object-not-found") console.warn("Хуучин профайлын зураг:", error);
  }
}

// ---------------------------------------------------------------------------
// Эд хөрөнгийн зураг — нэг хөрөнгөд олон файл
// ---------------------------------------------------------------------------

export const MAX_ASSET_IMAGE_BYTES = 10 * 1024 * 1024;

export async function uploadAssetImage(assetId: string, file: File): Promise<UploadedImage> {
  requireImage(file, MAX_ASSET_IMAGE_BYTES);
  return uploadToServer("assets", file, { key: assetId });
}

/** Эд хөрөнгийн зургийн файлыг устгана. */
export async function deleteAssetImageFile(path: string): Promise<void> {
  await removeEverywhere(path);
}

// ---------------------------------------------------------------------------
// Хандивын хайрцгийн эргэлтийн зураг
// ---------------------------------------------------------------------------

export const MAX_VISIT_PHOTO_BYTES = 10 * 1024 * 1024;

export async function uploadVisitPhoto(boxId: string, file: File): Promise<UploadedImage> {
  requireImage(file, MAX_VISIT_PHOTO_BYTES);
  return uploadToServer("donation_box_visits", file, { key: boxId });
}

// ---------------------------------------------------------------------------
// Долоо хоногийн хуваарийн постер — ганц, дахин байршуулахад сольно
// ---------------------------------------------------------------------------

export const MAX_SCHEDULE_POSTER_BYTES = 10 * 1024 * 1024;

export async function uploadSchedulePoster(file: File): Promise<string> {
  requireImage(file, MAX_SCHEDULE_POSTER_BYTES);
  return (await uploadToServer("schedule_poster", file)).url;
}

// ---------------------------------------------------------------------------
// Гарын авлагын баримт — админ байршуулна
// ---------------------------------------------------------------------------

export const MAX_HANDBOOK_FILE_BYTES = 25 * 1024 * 1024;

const ALLOWED_HANDBOOK_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export async function uploadHandbookFile(file: File): Promise<UploadedFile> {
  if (!file.type.startsWith("image/") && !ALLOWED_HANDBOOK_TYPES.includes(file.type)) {
    throw new Error("PDF, Word, Excel эсвэл зураг файл оруулна уу.");
  }
  if (file.size > MAX_HANDBOOK_FILE_BYTES) {
    throw new Error("Файлын хэмжээ 25MB-аас хэтэрч болохгүй.");
  }
  return uploadToServer("handbook", file);
}

export async function deleteHandbookFile(path: string): Promise<void> {
  await removeEverywhere(path);
}

// ---------------------------------------------------------------------------
// Санал хүсэлт, «Сайн мэдээ», «Илчлэл» — хэрэглэгч бүр өөрийн хавтас руу
// ---------------------------------------------------------------------------

export const MAX_FEEDBACK_IMAGE_BYTES = 10 * 1024 * 1024;

export async function uploadFeedbackImage(_uid: string, file: File): Promise<UploadedImage> {
  requireImage(file, MAX_FEEDBACK_IMAGE_BYTES);
  return uploadToServer("feedback", file);
}

export async function deleteFeedbackImage(path: string): Promise<void> {
  await removeEverywhere(path);
}

export async function uploadGospelPhoto(_uid: string, file: File): Promise<UploadedImage> {
  requireImage(file, MAX_FEEDBACK_IMAGE_BYTES);
  return uploadToServer("gospel", file);
}

/** Байхгүй эсвэл эрхгүй бол чимээгүй алгасна — бүртгэл аль хэдийн хадгалагдсан. */
export async function deleteGospelPhoto(path: string): Promise<void> {
  await removeQuietly(path, "Сайн мэдээний зургийг");
}

export async function uploadRevelationImage(_uid: string, file: File): Promise<UploadedImage> {
  requireImage(file, MAX_FEEDBACK_IMAGE_BYTES);
  return uploadToServer("revelations", file);
}

export async function deleteRevelationImage(path: string): Promise<void> {
  await removeQuietly(path, "Илчлэлийн зургийг");
}

// ---------------------------------------------------------------------------
// Харуулын байршлын зураг — «Газрын зургийн үйлчлэл → Байршлууд»
// ---------------------------------------------------------------------------

export async function uploadGuardPointImage(file: File): Promise<UploadedImage> {
  requireImage(file, MAX_FEEDBACK_IMAGE_BYTES);
  return uploadToServer("guard_points", file);
}

export async function deleteGuardPointImage(path: string): Promise<void> {
  await removeQuietly(path, "Байршлын зургийг");
}

// ---------------------------------------------------------------------------
// Нийтлэлийн зураг/видео
// ---------------------------------------------------------------------------

export type UploadedPostMedia = UploadedImage & {
  kind: "image" | "video" | "file";
  name?: string;
  size?: number;
};

/** Нийтлэлийн файлыг байршуулна; явцыг `onProgress`-оор (0–1) мэдээлнэ. */
export async function uploadPostMedia(
  _uid: string,
  file: File,
  onProgress?: (fraction: number) => void
): Promise<UploadedPostMedia> {
  const kind = file.type.startsWith("video/")
    ? "video"
    : file.type.startsWith("image/")
      ? "image"
      : POST_FILE_TYPES.includes(file.type)
        ? "file"
        : null;

  if (!kind) throw new Error("Зураг, видео эсвэл PDF/Word/Excel/PowerPoint файл оруулна уу.");
  if (kind === "file" && file.size > MAX_POST_FILE_BYTES) {
    throw new Error("Файлын хэмжээ 25MB-аас хэтэрч болохгүй.");
  }
  if (kind === "image" && file.size > MAX_POST_IMAGE_BYTES) {
    throw new Error("Зургийн хэмжээ 10MB-аас хэтэрч болохгүй.");
  }
  if (kind === "video" && file.size > MAX_POST_VIDEO_BYTES) {
    throw new Error("Видеоны хэмжээ 200MB-аас хэтэрч болохгүй.");
  }

  const uploaded = await uploadToServer("posts", file, { onProgress });
  return kind === "file" ? { kind, ...uploaded, name: file.name, size: file.size } : { kind, ...uploaded };
}

export async function deletePostMedia(path: string): Promise<void> {
  await removeQuietly(path, "Нийтлэлийн файлыг");
}
