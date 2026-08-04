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

/** Профайлын зургийг устгана. Байхгүй байсан ч алдаа шидэхгүй. */
export async function deleteProfilePhoto(uid: string): Promise<void> {
  try {
    await deleteObject(ref(storage, profilePhotoPath(uid)));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "storage/object-not-found") throw error;
  }
}
