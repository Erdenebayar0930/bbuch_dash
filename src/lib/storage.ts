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
