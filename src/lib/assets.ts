"use client";

import { apiFetch } from "./apiClient";

/** Агуулах эсвэл эд хөрөнгийн төрөл — хоёулаа ижил бүтэцтэй */
export type RefItem = {
  id: string;
  name: string;
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
  unit: string;
  code: string;
  note: string;
  createdAt: Date;
};

type AssetRow = Omit<Asset, "createdAt" | "images" | "lastCheck"> & {
  createdAt: string;
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
  unit: string;
  code: string;
  note: string;
};

/**
 * Шинэ эд хөрөнгө бүртгэнэ (зөвхөн админ).
 * Зураг байршуулахад id хэрэгтэй тул үүсгэсэн мөрийн id-г буцаана.
 */
export async function createAsset(input: AssetInput): Promise<string> {
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
export async function deleteAsset(id: string): Promise<void> {
  await apiFetch(`/api/assets/${id}`, { method: "DELETE" });
}

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

  const { deleteAssetImageFile } = await import("./storage");
  await deleteAssetImageFile(image.path);
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
};

/** Агуулах ба төрлийн жагсаалт. */
export async function getAssetMeta(): Promise<AssetMeta> {
  const data = await apiFetch<AssetMeta>("/api/assets/meta");
  return {
    warehouses: data.warehouses ?? [],
    categories: data.categories ?? [],
  };
}

/** Шинэ агуулах эсвэл төрөл нэмнэ (зөвхөн админ). */
export async function addMetaItem(
  kind: "warehouse" | "category",
  name: string
): Promise<RefItem> {
  const data = await apiFetch<{ item: RefItem }>("/api/assets/meta", {
    method: "POST",
    body: { kind, name },
  });
  return data.item;
}

/** Агуулах эсвэл төрлийг устгана (зөвхөн админ). */
export async function deleteMetaItem(
  kind: "warehouse" | "category",
  id: string
): Promise<void> {
  await apiFetch(
    `/api/assets/meta?kind=${kind}&id=${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}
