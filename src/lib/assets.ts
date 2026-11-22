"use client";

import { DEFAULT_ASSET_STATE, isAssetState, type AssetState } from "@/data/assetStates";

import { apiFetch } from "./apiClient";

/** Агуулах эсвэл эд хөрөнгийн төрөл — хоёулаа ижил бүтэцтэй */
export type RefItem = {
  id: string;
  name: string;
  /**
   * Кодчиллын үсэг — Байршлын ангилалд эхний, Төрөлд 2 дахь үсэг
   * (@see lib/assetCodes.ts). Хоосон бол оноогоогүй.
   */
  codeLetter?: string;
};

/** Эд хөрөнгийн зураг — файл нь Firebase Storage дээр */
export type AssetImage = {
  id: string;
  url: string;
  /** Storage доторх зам — файлыг устгахад хэрэгтэй */
  path: string;
};

/** Бүрэн бүтэн байдлын төлөв */
export type CheckStatus = "ok" | "damaged" | "short" | "missing";

export const checkStatusLabels: Record<CheckStatus, string> = {
  ok: "Бүрэн бүтэн",
  damaged: "Гэмтэлтэй",
  short: "Дутуу",
  missing: "Алга",
};

export type AssetCheck = {
  id: string;
  status: CheckStatus;
  foundQuantity: number;
  note: string;
  checkedAt: Date;
  /** Шалгасан хүний нэр — устсан бүртгэл дээр хоосон байж болно */
  checkedByName: string;
};

/** Жагсаалтад харуулах хамгийн сүүлийн шалгалтын товч */
export type LastCheck = {
  status: CheckStatus;
  foundQuantity: number;
  checkedAt: Date;
};

export type Asset = {
  id: string;
  name: string;
  /** profileOptions.aimags доторх түлхүүр; "" бол аймагт үл хамаарах */
  aimag: string;
  images: AssetImage[];
  lastCheck: LastCheck | null;
  categoryId: string | null;
  categoryName: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  quantity: number;
  /** Ангилал — Бүртгэлтэй, Засвартай, Ашиглалтын байдал, Акталсан */
  state: AssetState;
  unit: string;
  code: string;
  note: string;
  createdAt: Date;
};

type AssetRow = Omit<Asset, "createdAt" | "images" | "lastCheck" | "state"> & {
  createdAt: string;
  state?: string | null;
  images?: AssetImage[];
  lastCheck?: {
    status: CheckStatus;
    foundQuantity: number;
    checkedAt: string;
  } | null;
};

const toAsset = (row: AssetRow): Asset => ({
  ...row,
  aimag: row.aimag ?? "",
  state: isAssetState(row.state) ? row.state : DEFAULT_ASSET_STATE,
  unit: row.unit ?? "",
  code: row.code ?? "",
  note: row.note ?? "",
  images: row.images ?? [],
  lastCheck: row.lastCheck
    ? { ...row.lastCheck, checkedAt: new Date(row.lastCheck.checkedAt) }
    : null,
  createdAt: new Date(row.createdAt),
});

/**
 * Эд хөрөнгийн бүртгэл — шинэ нь эхэндээ.
 *
 * `aimag` өгвөл зөвхөн тухайн аймгийн хөрөнгө; өгөхгүй бол бүгд.
 */
export async function listAssets(aimag?: string): Promise<Asset[]> {
  const query = aimag ? `?aimag=${encodeURIComponent(aimag)}` : "";
  const data = await apiFetch<{ assets: AssetRow[] }>(`/api/assets${query}`);
  return (data.assets ?? []).map(toAsset);
}

export type AssetInput = {
  name: string;
  aimag: string;
  categoryId: string | null;
  warehouseId: string | null;
  quantity: number;
  state: AssetState;
  unit: string;
  code: string;
  note: string;
};

/**
 * Шинэ эд хөрөнгө бүртгэнэ (зөвхөн админ).
 * Зураг байршуулахад id хэрэгтэй тул үүсгэсэн мөрийн id-г буцаана.
 */
export async function createAsset(input: Omit<AssetInput, "code">): Promise<string> {
  const data = await apiFetch<{ asset: { id: string } }>("/api/assets", {
    method: "POST",
    body: input,
  });
  return data.asset.id;
}

/** Бүртгэлийг засна (зөвхөн админ). */
export async function updateAsset(
  id: string,
  patch: Partial<AssetInput>
): Promise<void> {
  await apiFetch(`/api/assets/${id}`, { method: "PATCH", body: patch });
}

/** Бүртгэлээс хасна (зөвхөн админ). */
/**
 * Зургийг Storage-д тавиад бүртгэлд холбоно.
 * Файл эхлээд Storage руу, дараа нь мөр нь Postgres-д бичигдэнэ.
 */
export async function attachAssetImage(
  assetId: string,
  file: File
): Promise<AssetImage> {
  const { uploadAssetImage } = await import("./storage");
  const uploaded = await uploadAssetImage(assetId, file);

  try {
    const data = await apiFetch<{ image: AssetImage }>(
      `/api/assets/${assetId}/images`,
      { method: "POST", body: uploaded }
    );
    return data.image;
  } catch (error) {
    // Бүртгэл бүтэлгүйтвэл эзэнгүй файл үлдээхгүй
    const { deleteAssetImageFile } = await import("./storage");
    await deleteAssetImageFile(uploaded.path).catch(() => {});
    throw error;
  }
}

/** Зургийг бүртгэлээс ба Storage-оос хоёуланг нь устгана. */
export async function removeAssetImage(
  assetId: string,
  image: AssetImage
): Promise<void> {
  await apiFetch(
    `/api/assets/${assetId}/images?imageId=${encodeURIComponent(image.id)}`,
    { method: "DELETE" }
  );

  // Бүртгэл аль хэдийн хасагдсан. Файлыг устгах эрх Storage дээр зөвхөн
  // админд тул Магтаалын гишүүнд энэ алхам бүтэлгүйтэж болно — файл нь хог
  // болж үлдэнэ, хэрэглэгчид алдаа харуулахгүй.
  try {
    const { deleteAssetImageFile } = await import("./storage");
    await deleteAssetImageFile(image.path);
  } catch (error) {
    console.warn("Зургийн файлыг устгаж чадсангүй:", error);
  }
}

type CheckRow = {
  id: string;
  status: CheckStatus;
  foundQuantity: number;
  note: string | null;
  checkedAt: string;
  checkedByName: string | null;
  checkedByLastName: string | null;
};

/** Тухайн хөрөнгийн шалгалтын түүх. */
export async function listAssetChecks(assetId: string): Promise<AssetCheck[]> {
  const data = await apiFetch<{ checks: CheckRow[] }>(
    `/api/assets/${assetId}/checks`
  );

  return (data.checks ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    foundQuantity: row.foundQuantity,
    note: row.note ?? "",
    checkedAt: new Date(row.checkedAt),
    checkedByName:
      [row.checkedByName, row.checkedByLastName].filter(Boolean).join(" ") ||
      "—",
  }));
}

/** Шинэ шалгалт бүртгэнэ (зөвхөн админ). */
export async function recordAssetCheck(
  assetId: string,
  input: { status: CheckStatus; foundQuantity: number; note: string }
): Promise<void> {
  await apiFetch(`/api/assets/${assetId}/checks`, {
    method: "POST",
    body: input,
  });
}

/** Тооллогын үе — идэвхтэй бол `endedAt` нь null */
export type CountSession = {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
};

export type CountState = {
  /** null бол тооллого явагдаагүй байна */
  session: CountSession | null;
  /** Энэ тооллогын явцад аль хэдийн шалгагдсан хөрөнгийн id-ууд */
  checkedAssetIds: Set<string>;
};

type CountRow = {
  session: { id: string; startedAt: string; endedAt: string | null } | null;
  checkedAssetIds?: string[];
};

const toCountState = (data: CountRow): CountState => ({
  session: data.session
    ? {
        id: data.session.id,
        startedAt: new Date(data.session.startedAt),
        endedAt: data.session.endedAt ? new Date(data.session.endedAt) : null,
      }
    : null,
  checkedAssetIds: new Set(data.checkedAssetIds ?? []),
});

/** Идэвхтэй тооллого ба тоологдсон хөрөнгүүд. */
export async function getCountState(): Promise<CountState> {
  return toCountState(await apiFetch<CountRow>("/api/assets/count"));
}

/** Тооллого эхлүүлнэ (зөвхөн админ). */
export async function startCount(): Promise<CountState> {
  return toCountState(
    await apiFetch<CountRow>("/api/assets/count", { method: "POST" })
  );
}

/** Идэвхтэй тооллогыг дуусгана (зөвхөн админ). */
export async function finishCount(): Promise<void> {
  await apiFetch("/api/assets/count", { method: "PATCH" });
}

export type AssetMeta = {
  warehouses: RefItem[];
  categories: RefItem[];
  /** Кодчиллын нэрс — Аяга таваг гэх мэт (3 дахь үсэг) */
  names: RefItem[];
};

/** Кодчиллын лавлах — Байршлын ангилал, Төрөл, Нэр */
export type MetaKind = "warehouse" | "category" | "name";

/** Агуулах ба төрлийн жагсаалт. */
export async function getAssetMeta(): Promise<AssetMeta> {
  const data = await apiFetch<AssetMeta>("/api/assets/meta");
  return {
    warehouses: data.warehouses ?? [],
    categories: data.categories ?? [],
    names: data.names ?? [],
  };
}

/** Шинэ Байршлын ангилал эсвэл Төрөл нэмнэ — кодчиллын үсэгтэй нь. */
export async function addMetaItem(
  kind: MetaKind,
  name: string,
  codeLetter?: string
): Promise<RefItem> {
  const data = await apiFetch<{ item: RefItem }>("/api/assets/meta", {
    method: "POST",
    body: { kind, name, codeLetter },
  });
  return data.item;
}

/** Байршлын ангилал эсвэл Төрлийн нэр ба/эсвэл кодчиллын үсгийг засна. */
export async function updateMetaItem(
  kind: MetaKind,
  id: string,
  patch: { name?: string; codeLetter?: string }
): Promise<RefItem> {
  const data = await apiFetch<{ item: RefItem }>("/api/assets/meta", {
    method: "PATCH",
    body: { kind, id, ...patch },
  });
  return data.item;
}

/** Агуулах эсвэл төрлийг устгана (зөвхөн админ). */
export async function deleteMetaItem(
  kind: MetaKind,
  id: string
): Promise<void> {
  await apiFetch(
    `/api/assets/meta?kind=${kind}&id=${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

/** Ширхэгийн түүхийн нэг мөр — бүртгэсэн, өөрчилсөн, зураг нэмсэн/хассан */
export type AssetHistoryEntry = {
  id: string;
  action: "created" | "updated" | "image_added" | "image_removed";
  changes: { field: string; from: string; to: string }[];
  actorName: string;
  createdAt: Date;
};

type HistoryRow = {
  id: string;
  action: string;
  changes: { field: string; from: string; to: string }[] | null;
  createdAt: string;
  actorFirstName: string | null;
  actorLastName: string | null;
};

export async function listAssetHistory(assetId: string): Promise<AssetHistoryEntry[]> {
  const data = await apiFetch<{ history: HistoryRow[] }>(`/api/assets/${assetId}/history`);
  return data.history.map((row) => ({
    id: row.id,
    action: (["created", "updated", "image_added", "image_removed"].includes(row.action)
      ? row.action
      : "updated") as AssetHistoryEntry["action"],
    changes: row.changes ?? [],
    actorName: [row.actorLastName, row.actorFirstName].filter(Boolean).join(" ") || "—",
    createdAt: new Date(row.createdAt),
  }));
}
