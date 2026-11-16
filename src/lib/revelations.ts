"use client";

import { DEFAULT_REVELATION_SOURCE } from "@/data/revelationOptions";

import { apiFetch } from "./apiClient";

export type RevelationImage = { url: string; path: string };

export type Revelation = {
  id: string;
  aimag: string;
  authorUid: string | null;
  authorName: string;
  authorPhotoUrl: string;
  body: string;
  /** Илчлэл авсан хүн — нийтлэгчээс өөр байж болно */
  receivedBy: string;
  /** Илчлэл ирсэн өдөр «YYYY-MM-DD» — нөхөж оруулж болно */
  revealedOn: string;
  images: RevelationImage[];
  createdAt: Date;
  /** Засагдсан бол — `createdAt`-аас ялгаатай */
  edited: boolean;
};

type RevelationRow = {
  id: string;
  aimag: string;
  authorUid: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorPhotoUrl: string | null;
  body: string | null;
  receivedBy: string | null;
  revealedOn: string | null;
  images: RevelationImage[] | null;
  createdAt: string;
  updatedAt: string;
};

const toRevelation = (row: RevelationRow): Revelation => {
  const createdAt = new Date(row.createdAt);
  const updatedAt = new Date(row.updatedAt);

  return {
    id: row.id,
    aimag: row.aimag,
    authorUid: row.authorUid,
    authorName:
      [row.authorFirstName, row.authorLastName].filter(Boolean).join(" ") ||
      "Нэргүй хэрэглэгч",
    authorPhotoUrl: row.authorPhotoUrl ?? "",
    body: row.body ?? "",
    receivedBy: row.receivedBy || DEFAULT_REVELATION_SOURCE,
    revealedOn: row.revealedOn || row.createdAt.slice(0, 10),
    images: row.images ?? [],
    createdAt,
    // Үүсгэх үед хоёр огноо хэдэн мс зөрж болно — минутаас их бол засагдсан
    edited: updatedAt.getTime() - createdAt.getTime() > 60_000,
  };
};

/** `kind` — Илчлэл эсвэл «Тушаал»-ын табууд (@see data/revelationOptions.ts) */
const kindQuery = (aimag: string, kind: string) =>
  `aimag=${encodeURIComponent(aimag)}&kind=${encodeURIComponent(kind)}`;

export async function listRevelations(aimag: string, kind = "revelation"): Promise<Revelation[]> {
  const data = await apiFetch<{ revelations: RevelationRow[] }>(
    `/api/revelations?${kindQuery(aimag, kind)}`
  );
  return data.revelations.map(toRevelation);
}

/**
 * Нийтлэл үүсгэнэ — эхлээд зургуудыг байршуулна. Нийтлэл хадгалагдаагүй
 * бол байршуулсан зургуудыг буцааж устгана.
 */
export async function createRevelation(
  uid: string,
  aimag: string,
  input: { body: string; receivedBy: string; revealedOn: string; files: File[] },
  kind = "revelation"
): Promise<Revelation> {
  const { uploadRevelationImage, deleteRevelationImage } = await import("./storage");
  const images: RevelationImage[] = [];

  try {
    for (const file of input.files) {
      images.push(await uploadRevelationImage(uid, file));
    }

    const data = await apiFetch<{ revelation: RevelationRow }>(
      `/api/revelations?${kindQuery(aimag, kind)}`,
      {
        method: "POST",
        body: {
          body: input.body,
          receivedBy: input.receivedBy,
          revealedOn: input.revealedOn,
          images,
        },
      }
    );
    return toRevelation(data.revelation);
  } catch (error) {
    await Promise.all(images.map((image) => deleteRevelationImage(image.path)));
    throw error;
  }
}

/**
 * Нийтлэлийг засна: үлдээх хуучин зургууд + шинэ файлууд. Хадгалагдсаны
 * дараа хасагдсан хуучин зургуудыг Storage-аас цэвэрлэнэ.
 */
export async function updateRevelation(
  uid: string,
  revelation: Revelation,
  input: {
    body: string;
    receivedBy: string;
    revealedOn: string;
    keep: RevelationImage[];
    files: File[];
  }
): Promise<Revelation> {
  const { uploadRevelationImage, deleteRevelationImage } = await import("./storage");
  const uploaded: RevelationImage[] = [];

  try {
    for (const file of input.files) {
      uploaded.push(await uploadRevelationImage(uid, file));
    }

    const data = await apiFetch<{ revelation: RevelationRow }>(
      `/api/revelations/${revelation.id}?aimag=${encodeURIComponent(revelation.aimag)}`,
      {
        method: "PATCH",
        body: {
          body: input.body,
          receivedBy: input.receivedBy,
          revealedOn: input.revealedOn,
          images: [...input.keep, ...uploaded],
        },
      }
    );

    const kept = new Set(input.keep.map((image) => image.path));
    void Promise.all(
      revelation.images
        .filter((image) => !kept.has(image.path))
        .map((image) => deleteRevelationImage(image.path))
    );

    return toRevelation(data.revelation);
  } catch (error) {
    await Promise.all(uploaded.map((image) => deleteRevelationImage(image.path)));
    throw error;
  }
}

/** Нийтлэлийг устгаад зургийг нь цэвэрлэнэ. */
export async function deleteRevelation(revelation: Revelation): Promise<void> {
  await apiFetch(
    `/api/revelations/${revelation.id}?aimag=${encodeURIComponent(revelation.aimag)}`,
    { method: "DELETE" }
  );

  const { deleteRevelationImage } = await import("./storage");
  void Promise.all(revelation.images.map((image) => deleteRevelationImage(image.path)));
}
