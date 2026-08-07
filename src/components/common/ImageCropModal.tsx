"use client";

import React, { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Modal } from "@/components/ui/modal";

/** Гаргах зургийн хамгийн урт талын анхдагч дээд хэмжээ (пиксел) */
const DEFAULT_MAX_DIMENSION = 1600;
/** JPEG чанар — 0.85 нь нүдэнд мэдэгдэхгүй боловч хэмжээг эрс багасгана */
const QUALITY = 0.85;

type ImageCropModalProps = {
  /** null бол цонх хаалттай */
  file: File | null;
  /** Талын харьцаа — 1 нь квадрат, 4/3 нь өргөн */
  aspect?: number;
  /** Хамгийн урт талын дээд хэмжээ — профайл зурагт бага утга тохирно */
  maxDimension?: number;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
};

async function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // next/image-ийн `Image`-тэй андуурахгүйн тулд DOM элементийг шууд үүсгэнэ
    const image = document.createElement("img");
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", reject);
    image.src = url;
  });
}

/**
 * Сонгосон хэсгийг тайрч, шаардлагатай бол багасгаад JPEG болгоно.
 *
 * Утасны камерын зураг 4-8MB байдаг; тайрч 1600px хүртэл багасгахад
 * ихэвчлэн 200-500KB болдог тул байршуулалт мэдэгдэхүйц хурдан болно.
 */
async function cropAndResize(
  imageSrc: string,
  crop: Area,
  maxDimension: number
): Promise<Blob> {
  const image = await createImage(imageSrc);

  // Тайрсан хэсэг нь хязгаараас том бол пропорцоо хадгалж багасгана
  const scale = Math.min(1, maxDimension / Math.max(crop.width, crop.height));
  const width = Math.round(crop.width * scale);
  const height = Math.round(crop.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context алга.");

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    width,
    height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Зураг боловсруулж чадсангүй.")),
      "image/jpeg",
      QUALITY
    );
  });
}

export default function ImageCropModal({
  file,
  aspect = 4 / 3,
  maxDimension = DEFAULT_MAX_DIMENSION,
  onCancel,
  onDone,
}: ImageCropModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Файл солигдох бүрд шинэ URL үүсгэж, хуучныг нь чөлөөлнө
  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    setError(null);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !area) return;

    setWorking(true);
    setError(null);

    try {
      onDone(await cropAndResize(imageSrc, area, maxDimension));
    } catch (err) {
      console.error("Зураг тайрахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal isOpen={!!file} onClose={onCancel} className="max-w-3xl p-4">
      <div className="grid gap-4">
        <div className="relative h-[380px] w-full overflow-hidden rounded-2xl bg-black">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-white/70">
              Ачаалж байна...
            </div>
          )}
        </div>

        <div className="grid gap-3 rounded-2xl bg-white p-4 dark:bg-gray-900">
          <div>
            <p className="text-theme-sm font-semibold text-gray-900 dark:text-white">
              Зургийг тайрах
            </p>
            <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
              {file?.name} — хадгалахад {maxDimension}px хүртэл багасгана.
            </p>
          </div>

          <div>
            <label
              htmlFor="crop-zoom"
              className="text-theme-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Томруулалт
            </label>
            <input
              id="crop-zoom"
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 dark:bg-white/10"
            />
          </div>

          {error && (
            <p className="text-theme-xs text-error-500">{error}</p>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
            >
              Алгасах
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={working || !area}
              className="rounded-lg bg-accent-600 px-4 py-2 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {working ? "Боловсруулж байна..." : "Тайрч нэмэх"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
