"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

import ImageCropModal from "@/components/common/ImageCropModal";
import ImageViewer from "@/components/common/ImageViewer";
import { Modal } from "@/components/ui/modal";
import {
  DEFAULT_ASSET_STATE,
  assetStateLabels,
  assetStates,
  type AssetState,
} from "@/data/assetStates";
import {
  attachAssetImage,
  createAsset,
  createAssets,
  removeAssetImage,
  updateAsset,
  type Asset,
  type AssetImage,
  type AssetInput,
  type RefItem,
} from "@/lib/assets";
import { MAX_ASSET_IMAGE_BYTES } from "@/lib/storage";

/** Нэг эд хөрөнгөд зөвшөөрөх зургийн тоо — серверийн хязгаартай ижил */
const MAX_IMAGES = 10;

/** Нэг удаад олноор бүртгэх ширхэгийн дээд тоо — серверийнхтэй ижил */
const MAX_BULK = 500;

/** Хадгалахыг хүлээж буй файл — урьдчилж харуулах blob URL-тэй нь хамт */
type PendingImage = { file: File; url: string };

type AssetFormModalProps = {
  isOpen: boolean;
  /** null бол шинээр бүртгэнэ */
  asset: Asset | null;
  warehouses: RefItem[];
  categories: RefItem[];
  /**
   * Аймгийн тусдаа хуудсанд нээгдсэн бол тухайн аймгийн түлхүүр. Ийм үед
   * аймаг нь сонголт биш — маягт үүнийг бэхэлж, зөвхөн мэдээлэл болгон харуулна.
   */
  lockedAimag?: string;
  /** Шинэ бүртгэлийн анхдагч байршил ба ангилал — сонгосон шүүлтүүрээс */
  defaultWarehouseId?: string | null;
  defaultState?: AssetState;
  /**
   * Шинээр бүртгэхэд сонгож болох ангиллууд — Ерөнхий бүртгэл дээр зөвхөн
   * «Бүртгэлтэй». Өгөхгүй бол бүгд. Засахад үргэлж бүгд.
   */
  createStates?: AssetState[];
  onClose: () => void;
  onSaved: () => void;
};

const emptyInput: AssetInput = {
  name: "",
  aimag: "",
  categoryId: null,
  warehouseId: null,
  quantity: 1,
  state: DEFAULT_ASSET_STATE,
  unit: "ш",
  code: "",
  note: "",
};

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

export default function AssetFormModal({
  isOpen,
  asset,
  warehouses,
  categories,
  lockedAimag,
  defaultWarehouseId = null,
  defaultState = DEFAULT_ASSET_STATE,
  createStates,
  onClose,
  onSaved,
}: AssetFormModalProps) {
  const stateOptions = !asset && createStates?.length ? createStates : assetStates;
  const initialState = stateOptions.includes(defaultState) ? defaultState : stateOptions[0];
  const [form, setForm] = useState<AssetInput>(emptyInput);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /** Аль хэдийн байршсан зургууд (зөвхөн засах үед) */
  const [images, setImages] = useState<AssetImage[]>([]);
  /** Шинэ хөрөнгө үүсгэх үед — хадгалсны дараа байршуулах файлууд */
  const [pending, setPending] = useState<PendingImage[]>([]);
  /** Тайрах цонхоор дараалан өнгөрөх файлууд */
  const [queue, setQueue] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  /** Бүтнээр нь томоор харуулж буй зургийн хаяг */
  const [viewer, setViewer] = useState<string | null>(null);

  /** Олон ширхэг — код бүр тусдаа эд хөрөнгө (зөвхөн шинээр бүртгэхэд) */
  const [bulk, setBulk] = useState(false);
  const [codeMode, setCodeMode] = useState<"range" | "list">("range");
  const [prefix, setPrefix] = useState("");
  const [rangeFrom, setRangeFrom] = useState("1");
  const [rangeTo, setRangeTo] = useState("10");
  const [digits, setDigits] = useState("3");
  const [codeText, setCodeText] = useState("");

  const bulkCodes = useMemo(() => {
    if (codeMode === "list") {
      return [...new Set(codeText.split(/[\n,;]+/).map((code) => code.trim()).filter(Boolean))];
    }
    const from = Number(rangeFrom);
    const to = Number(rangeTo);
    const width = Math.min(Math.max(Number(digits) || 0, 0), 8);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) return [];
    const total = Math.min(to - from + 1, MAX_BULK);
    return Array.from({ length: total }, (_, index) => `${prefix.trim()}${String(from + index).padStart(width, "0")}`);
  }, [codeMode, codeText, prefix, rangeFrom, rangeTo, digits]);

  // Цонх нээгдэх бүрд засаж буй мөрийн утгаар дүүргэнэ
  useEffect(() => {
    setImages(asset?.images ?? []);
    // Хуучин урьдчилсан харагдацын blob-уудыг чөлөөлж байж л хоослоно
    setPending((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
    setQueue([]);
    setViewer(null);
    setBulk(false);
    setCodeText("");
    setForm(
      asset
        ? {
            name: asset.name,
            aimag: asset.aimag,
            categoryId: asset.categoryId,
            warehouseId: asset.warehouseId,
            quantity: asset.quantity,
            state: asset.state,
            unit: asset.unit,
            code: asset.code,
            note: asset.note,
          }
        : // Аймгийн хуудсанд шинээр бүртгэвэл тухайн аймагт нь шууд хамаарна
          {
            ...emptyInput,
            aimag: lockedAimag ?? "",
            warehouseId: defaultWarehouseId,
            state: initialState,
          }
    );
    setError(null);
  }, [asset, isOpen, lockedAimag, defaultWarehouseId, initialState]);

  const update = <K extends keyof AssetInput>(key: K, value: AssetInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const totalImages = images.length + pending.length;

  /** Сонгосон файлууд — нэг нэгээр нь тайрах цонхоор дамжина */
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const picked = Array.from(files).slice(0, MAX_IMAGES - totalImages);
    const tooBig = picked.find((file) => file.size > MAX_ASSET_IMAGE_BYTES);

    if (tooBig) {
      setError(`${tooBig.name} — зургийн хэмжээ 10MB-аас хэтэрсэн байна.`);
      return;
    }

    setError(null);
    setQueue(picked);
  };

  /** Тайрсан зургийг байршуулах эсвэл хүлээлгэнд нэмэх */
  const acceptImage = async (file: File) => {
    // Шинээр үүсгэж байгаа бол id хараахан байхгүй — хадгалсны дараа явуулна
    if (!asset) {
      setPending((prev) => [...prev, { file, url: URL.createObjectURL(file) }]);
      return;
    }

    setUploading(true);
    try {
      const image = await attachAssetImage(asset.id, file);
      setImages((prev) => [...prev, image]);
      onSaved();
    } catch (err) {
      console.error("Зураг байршуулахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Зураг байршуулж чадсангүй.");
    } finally {
      setUploading(false);
    }
  };

  const handleCropDone = async (blob: Blob) => {
    const source = queue[0];
    if (!source) return;

    // Тайрсан үр дүн үргэлж JPEG — нэрийг нь ч тааруулна
    const name = source.name.replace(/\.[^.]+$/, "") + ".jpg";
    setQueue((prev) => prev.slice(1));

    await acceptImage(new File([blob], name, { type: "image/jpeg" }));
  };

  /** Тайрахыг алгасвал тухайн зургийг оруулахгүй, дараагийнх руу шилжинэ */
  const handleCropCancel = () => setQueue((prev) => prev.slice(1));

  const handleRemoveImage = async (image: AssetImage) => {
    if (!asset) return;

    setUploading(true);
    try {
      await removeAssetImage(asset.id, image);
      setImages((prev) => prev.filter((item) => item.id !== image.id));
      onSaved();
    } catch (err) {
      console.error("Зураг устгахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Зураг устгаж чадсангүй.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Нэр талбар маягтад байхгүй — Төрлийн нэр, эсвэл код, эсвэл хуучин нэр
      const categoryName = categories.find((item) => item.id === form.categoryId)?.name;
      const code = form.code.trim();
      const name = categoryName || (bulk && !asset ? "" : code) || form.name.trim();
      if (!name) {
        throw new Error(bulk && !asset ? "Төрлөө сонгоно уу." : "Код эсвэл төрлөө оруулна уу.");
      }
      const input = { ...form, name };

      if (asset) {
        await updateAsset(asset.id, input);
      } else if (bulk) {
        if (bulkCodes.length === 0) throw new Error("Код оруулна уу.");
        await createAssets(input, bulkCodes);
      } else {
        // Зураг байршуулахад id хэрэгтэй тул эхлээд мөрийг үүсгэнэ
        const id = await createAsset(input);

        for (const item of pending) {
          await attachAssetImage(id, item.file);
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error("Эд хөрөнгө хадгалахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg p-0">
      <form onSubmit={handleSubmit} className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {asset ? "Эд хөрөнгө засах" : "Эд хөрөнгө бүртгэх"}
        </h3>

        <div className="mt-5 grid gap-4">
          {/* Ширхэг бүр тусдаа эд хөрөнгө — олноор бүртгэхэд код бүрт нэг мөр */}
          {!asset && (
            <div role="tablist" aria-label="Бүртгэх хэлбэр" className="flex w-fit rounded-lg border border-gray-200 p-0.5 dark:border-white/10">
              {([false, true] as const).map((multi) => (
                <button
                  key={String(multi)}
                  type="button"
                  role="tab"
                  aria-selected={bulk === multi}
                  onClick={() => setBulk(multi)}
                  className={`rounded-md px-3 py-1.5 text-theme-sm font-medium transition-colors ${
                    bulk === multi
                      ? "bg-accent-600 text-white"
                      : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                  }`}
                >
                  {multi ? "Олон ширхэг" : "Нэг ширхэг"}
                </button>
              ))}
            </div>
          )}

          {bulk && !asset ? (
            <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-white/10">
              <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                Код <span className="text-gray-400">(инвентарын дугаар, сериал)</span>
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Ширхэг бүр өөрийн кодтой, тусдаа эд хөрөнгө болж бүртгэгдэнэ. Доорх төрөл, агуулах, ангилал, мэдээлэл
                нь бүгдэд ижил — дараа нь ширхэг тус бүрийг засаж болно.
              </p>
              <div className="flex w-fit rounded-lg bg-gray-100 p-0.5 dark:bg-white/5">
                {(["range", "list"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCodeMode(mode)}
                    className={`rounded-md px-2.5 py-1 text-theme-xs font-medium ${
                      codeMode === mode ? "bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white" : "text-gray-500"
                    }`}
                  >
                    {mode === "range" ? "Дугаарлах" : "Код бүрийг бичих"}
                  </button>
                ))}
              </div>
              {codeMode === "range" ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="col-span-2 flex flex-col gap-1 text-theme-xs text-gray-500 sm:col-span-1 dark:text-gray-400">
                    Угтвар
                    <input value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="AYG-" maxLength={60} className={`${fieldClass} h-10`} />
                  </label>
                  <label className="flex flex-col gap-1 text-theme-xs text-gray-500 dark:text-gray-400">
                    Эхлэх
                    <input type="number" min={0} value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} className={`${fieldClass} h-10`} />
                  </label>
                  <label className="flex flex-col gap-1 text-theme-xs text-gray-500 dark:text-gray-400">
                    Дуусах
                    <input type="number" min={0} value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} className={`${fieldClass} h-10`} />
                  </label>
                  <label className="flex flex-col gap-1 text-theme-xs text-gray-500 dark:text-gray-400">
                    Оронгийн тоо
                    <input type="number" min={0} max={8} value={digits} onChange={(event) => setDigits(event.target.value)} className={`${fieldClass} h-10`} />
                  </label>
                </div>
              ) : (
                <textarea
                  value={codeText}
                  onChange={(event) => setCodeText(event.target.value)}
                  rows={4}
                  placeholder={"AYG-001\nAYG-002\nAYG-003"}
                  aria-label="Кодууд — мөр бүрт нэг"
                  className={`${fieldClass} h-auto py-2.5 font-mono`}
                />
              )}
              <p className="text-theme-xs font-medium text-gray-700 dark:text-gray-300">
                {bulkCodes.length > 0
                  ? `${bulkCodes.length} эд хөрөнгө бүртгэгдэнэ: ${bulkCodes.slice(0, 3).join(", ")}${
                      bulkCodes.length > 3 ? ` … ${bulkCodes[bulkCodes.length - 1]}` : ""
                    }`
                  : "Код оруулна уу"}
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="asset-code" className={labelClass}>
                Код <span className="text-gray-400">(инвентарын дугаар, сериал)</span>
              </label>
              <input
                id="asset-code"
                value={form.code}
                onChange={(event) => update("code", event.target.value)}
                placeholder="Жишээ нь: AYG-001"
                className={`${fieldClass} font-mono`}
                autoFocus
              />
            </div>
          )}

          {/* Нэр маягтад харагдахгүй — хадгалахад Төрлийн нэрээс (эсвэл кодоос) автоматаар */}

          {/* Аймаг маягтад харагдахгүй — хуудасныхаа аймагт (lockedAimag) автоматаар хамаарна */}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className={labelClass}>Ангилал</span>
              <div role="radiogroup" aria-label="Ангилал" className="flex flex-wrap gap-1.5">
                {stateOptions.map((state) => {
                  const selected = form.state === state;
                  return (
                    <button
                      key={state}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => update("state", state)}
                      className={`h-9 rounded-lg px-3.5 text-theme-sm font-medium transition-colors ${
                        selected
                          ? "bg-accent-600 text-white"
                          : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400"
                      }`}
                    >
                      {assetStateLabels[state]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="asset-category" className={labelClass}>
                Төрөл
              </label>
              <select
                id="asset-category"
                value={form.categoryId ?? ""}
                onChange={(event) =>
                  update("categoryId", event.target.value || null)
                }
                className={fieldClass}
              >
                <option value="">Сонгоогүй</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="asset-warehouse" className={labelClass}>
                Агуулах
              </label>
              <select
                id="asset-warehouse"
                value={form.warehouseId ?? ""}
                onChange={(event) =>
                  update("warehouseId", event.target.value || null)
                }
                className={fieldClass}
              >
                <option value="">Сонгоогүй</option>
                {warehouses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

          </div>

          <div>
            <label htmlFor="asset-note" className={labelClass}>
              Мэдээлэл <span className="text-gray-400">(өнгө, байдал, хаана, хэнд байгаа …)</span>
            </label>
            <textarea
              id="asset-note"
              value={form.note}
              onChange={(event) => update("note", event.target.value)}
              rows={2}
              className={`${fieldClass} h-auto py-2.5`}
            />
          </div>

          {/* Зургууд — олон ширхэг бүртгэхэд биш (ширхэг тус бүр дээр дараа нь нэмнэ) */}
          {bulk && !asset ? (
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Зургийг бүртгэсний дараа ширхэг тус бүрийг засаж нэмнэ.
            </p>
          ) : (
          <div>
            <p className={labelClass}>
              Зураг
              <span className="ml-1.5 font-normal text-gray-400">
                {totalImages}/{MAX_IMAGES}
              </span>
            </p>

            <div className="flex flex-wrap gap-2">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200 dark:border-white/10"
                >
                  <button
                    type="button"
                    onClick={() => setViewer(image.url)}
                    aria-label="Зургийг томоор харах"
                    className="block h-full w-full cursor-zoom-in"
                  >
                    <Image
                      src={image.url}
                      alt=""
                      width={80}
                      height={80}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(image)}
                    disabled={uploading}
                    aria-label="Зураг устгах"
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-error-500 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" strokeWidth={2.5} />
                  </button>
                </div>
              ))}

              {/* Шинэ хөрөнгө — хадгалах хүртэл хүлээж буй файлууд */}
              {pending.map((item, index) => (
                <div
                  key={item.url}
                  className="relative h-20 w-20 overflow-hidden rounded-lg border border-dashed border-gray-300 dark:border-white/20"
                >
                  <button
                    type="button"
                    onClick={() => setViewer(item.url)}
                    aria-label={`${item.file.name} — томоор харах`}
                    className="block h-full w-full cursor-zoom-in"
                  >
                    {/* blob: хаягийг next/image боловсруулж чадахгүй тул энгийн img */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.file.name}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(item.url);
                      setPending((prev) => prev.filter((_, i) => i !== index));
                    }}
                    aria-label="Хасах"
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-error-500"
                  >
                    <X className="h-3 w-3" strokeWidth={2.5} />
                  </button>
                </div>
              ))}

              {totalImages < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-gray-500 transition-colors hover:border-accent-400 hover:text-accent-600 disabled:opacity-50 dark:border-white/20 dark:text-gray-400"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.8} />
                  ) : (
                    <>
                      <ImagePlus className="h-5 w-5" strokeWidth={1.8} />
                      <span className="text-[10px]">Нэмэх</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                handleFiles(event.target.files);
                event.target.value = "";
              }}
            />

            {!asset && pending.length > 0 && (
              <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
                Зургууд хадгалсны дараа байршина.
              </p>
            )}
          </div>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            Буцах
          </button>
          <button
            type="submit"
            disabled={saving || (bulk && !asset && bulkCodes.length === 0)}
            className="rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Хадгалж байна..." : bulk && !asset ? `${bulkCodes.length} эд хөрөнгө бүртгэх` : "Хадгалах"}
          </button>
        </div>
      </form>

      {/* Сонгосон зураг бүрийг дараалан тайрч, багасгаад оруулна */}
      <ImageCropModal
        file={queue[0] ?? null}
        onCancel={handleCropCancel}
        onDone={handleCropDone}
      />

      {/* Сонгосон зургийг бүтнээр нь томоор харах */}
      <ImageViewer src={viewer} onClose={() => setViewer(null)} />
    </Modal>
  );
}
