import "server-only";

import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { UPLOADS_PREFIX } from "@/lib/storageUrl";

/**
 * Байршуулсан файлуудыг өөрийн сервер (VPS) дээр хадгална — Firebase Storage-ийн оронд.
 *
 * Хавтас нь аппын фолдероос ГАДУУР байх ёстой: деплой бүр `/home/bbuch/app`-ыг
 * бүхэлд нь сольдог тул дотор нь хадгалсан файл дараагийн деплойд алга болно.
 * Тиймээс прод дээр анхдагч нь `../uploads` (= `/home/bbuch/uploads`), локал
 * дээр репо доторх `.uploads/` (gitignore-д орсон).
 *
 * Файлын нэр бүр санамсаргүй UUID — URL нь таамаглагдахгүй. Firebase-ийн татах
 * URL ч мөн адил "холбоостой хүн харна" зарчмаар ажилладаг байсан.
 */
export function uploadRoot(): string {
  const configured = process.env.UPLOAD_DIR?.trim();
  if (configured) return path.resolve(configured);
  return process.env.NODE_ENV === "production"
    ? path.resolve(process.cwd(), "..", "uploads")
    : path.resolve(process.cwd(), ".uploads");
}

const MB = 1024 * 1024;

/** Зөвшөөрөгдөх төрөл → өргөтгөл. SVG-г санаатай оруулаагүй (скрипт агуулж болно). */
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/bmp": "bmp",
};

const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/3gpp": "3gp",
};

const DOC_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

/** Өргөтгөл → Content-Type (файл түгээхэд) */
export const CONTENT_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries({ ...IMAGE_TYPES, ...VIDEO_TYPES, ...DOC_TYPES }).map(([type, ext]) => [ext, type])
);

/**
 * Хэн юуг хаана хадгалах вэ — storage.rules-ийн дүрмийг яг давтана.
 *
 * `folder` — `uid`: хэрэглэгч өөрийн хавтас руу; `key`: хөрөнгө/хайрцгийн ID;
 * `none`: нэг хавтас. `write`/`remove` — хэн хийж чадах.
 * `replace` — шинэ файл орход хавтас дахь хуучныг устгана (ганц зурагтай зүйл).
 */
type Access = "signed-in" | "active" | "admin";

type Scope = {
  folder: "uid" | "key" | "none";
  write: Access;
  remove: "owner-or-admin" | "admin" | "owner";
  limit: (type: string) => number | null;
  replace?: boolean;
};

const imagesUpTo = (bytes: number) => (type: string) => (type in IMAGE_TYPES ? bytes : null);

export const SCOPES: Record<string, Scope> = {
  profile_photos: { folder: "uid", write: "signed-in", remove: "owner", limit: imagesUpTo(5 * MB), replace: true },
  assets: { folder: "key", write: "active", remove: "admin", limit: imagesUpTo(10 * MB) },
  donation_box_visits: { folder: "key", write: "admin", remove: "admin", limit: imagesUpTo(10 * MB) },
  schedule_poster: { folder: "none", write: "admin", remove: "admin", limit: imagesUpTo(10 * MB), replace: true },
  handbook: {
    folder: "none",
    write: "admin",
    remove: "admin",
    limit: (type) => (type in IMAGE_TYPES || type in DOC_TYPES ? 25 * MB : null),
  },
  feedback: { folder: "uid", write: "active", remove: "owner-or-admin", limit: imagesUpTo(10 * MB) },
  gospel: { folder: "uid", write: "active", remove: "owner-or-admin", limit: imagesUpTo(10 * MB) },
  revelations: { folder: "uid", write: "active", remove: "owner-or-admin", limit: imagesUpTo(10 * MB) },
  /** Харуулын «Газрын зургийн үйлчлэл → Байршлууд» — цэгийн зураг */
  guard_points: { folder: "uid", write: "active", remove: "owner-or-admin", limit: imagesUpTo(10 * MB) },
  posts: {
    folder: "uid",
    write: "active",
    remove: "owner-or-admin",
    limit: (type) =>
      type in IMAGE_TYPES ? 10 * MB : type in VIDEO_TYPES ? 200 * MB : type in DOC_TYPES ? 25 * MB : null,
  },
};

export const extensionFor = (type: string) =>
  IMAGE_TYPES[type] ?? VIDEO_TYPES[type] ?? DOC_TYPES[type] ?? null;

/** Замын нэг хэсэг — uid, UUID, Firebase ID г.м. */
const SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;
const FILE_NAME = /^[A-Za-z0-9_-]{1,128}\.[a-z0-9]{1,5}$/;

export const isSafeSegment = (value: string) => SEGMENT.test(value);

/**
 * `posts/<uid>/<file>` маягийн замыг шалгаж, диск дээрх бүтэн зам болгоно.
 * Хавтаснаас гадагш гарах (`..`, абсолют зам) бүхнийг татгалзана.
 */
export function resolveStored(relative: string): string | null {
  const parts = relative.split("/");
  if (parts.length < 2 || parts.length > 4) return null;
  const file = parts[parts.length - 1];
  if (!FILE_NAME.test(file) || !parts.slice(0, -1).every(isSafeSegment)) return null;
  if (!(parts[0] in SCOPES)) return null;

  const root = uploadRoot();
  const full = path.resolve(root, ...parts);
  return full.startsWith(root + path.sep) ? full : null;
}

export const publicUrl = (relative: string) => `${UPLOADS_PREFIX}${relative}`;

export class UploadError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/**
 * Хүсэлтийн биеийг (файлын байтуудыг) шууд диск рүү урсгаж бичнэ — санах ойд
 * бүхэлд нь ачаалахгүй (видео 200MB хүртэл). Хэмжээ хэтэрвэл тасалж, түр файлыг
 * устгана. Бүрэн бичигдсэний дараа л жинхэнэ нэр рүү шилжүүлнэ.
 */
export async function saveUpload(
  body: ReadableStream<Uint8Array>,
  folder: string,
  ext: string,
  limit: number,
  replace: boolean
): Promise<string> {
  const dir = path.resolve(uploadRoot(), ...folder.split("/"));
  await mkdir(dir, { recursive: true });

  const name = `${randomUUID()}.${ext}`;
  const final = path.join(dir, name);
  const temp = path.join(dir, `.${name}.part`);

  let size = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      if (size > limit) {
        callback(new UploadError(`Файлын хэмжээ ${Math.round(limit / MB)}MB-аас хэтэрч болохгүй.`, 413));
        return;
      }
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(body as import("node:stream/web").ReadableStream<Uint8Array>),
      counter,
      createWriteStream(temp, { flags: "wx" })
    );
    if (size === 0) throw new UploadError("Файл хоосон байна.");
    await rename(temp, final);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }

  if (replace) {
    // Ганц зурагтай зүйл (профайл, постер) — хуучныг цэвэрлэнэ
    for (const other of await readdir(dir)) {
      if (other !== name) await rm(path.join(dir, other), { force: true });
    }
  }

  return `${folder}/${name}`;
}

/** Файлыг устгана — байхгүй байсан ч алдаа шидэхгүй. */
export async function removeStored(relative: string): Promise<void> {
  const full = resolveStored(relative);
  if (!full) throw new UploadError("Файлын зам буруу байна.");
  await rm(full, { force: true });
}

/** Хавтсыг бүхэлд нь устгана (профайлын зураг хасах). */
export async function removeFolder(folder: string): Promise<void> {
  const parts = folder.split("/");
  if (!(parts[0] in SCOPES) || !parts.every(isSafeSegment)) throw new UploadError("Зам буруу байна.");
  await rm(path.resolve(uploadRoot(), ...parts), { recursive: true, force: true });
}

export async function statStored(relative: string) {
  const full = resolveStored(relative);
  if (!full) return null;
  try {
    const info = await stat(full);
    return info.isFile() ? { full, size: info.size, mtime: info.mtime } : null;
  } catch {
    return null;
  }
}
