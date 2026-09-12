"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";

import { getSchedulePosterUrl, saveSchedulePosterUrl } from "@/lib/schedule";
import { uploadSchedulePoster } from "@/lib/storage";

/** Долоо хоногийн хуваарийн постер зургийг байршуулах, солих, устгах хэсэг. */
export default function SchedulePosterUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSchedulePosterUrl()
      .then(setImageUrl)
      .catch((err) => {
        console.error("Постер зураг ачаалахад алдаа гарлаа:", err);
        setError("Одоогийн зургийг ачаалж чадсангүй.");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError("");

    try {
      const uploadedUrl = await uploadSchedulePoster(file);
      const savedUrl = await saveSchedulePosterUrl(uploadedUrl);
      setImageUrl(savedUrl);
    } catch (err) {
      console.error("Постер зураг байршуулахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Байршуулж чадсангүй.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError("");

    try {
      const savedUrl = await saveSchedulePosterUrl("");
      setImageUrl(savedUrl);
    } catch (err) {
      console.error("Постер зураг устгахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Устгаж чадсангүй.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="surface p-5">
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Ачаалж байна...
        </p>
      </div>
    );
  }

  return (
    <div className="surface p-5">
      <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
        Хуваарийн постер зураг
      </h3>
      <p className="mt-0.5 text-theme-sm text-gray-500 dark:text-gray-400">
        Энд байршуулсан зураг хянах самбар дээр бүгдэд шууд харагдана. Дахин
        байршуулбал хуучин зургийг дарна. (Дээд хэмжээ 10MB)
      </p>

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Одоогийн хуваарийн постер"
          className="mt-4 w-full max-w-2xl rounded-xl border border-gray-200 dark:border-white/10"
        />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-theme-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" strokeWidth={1.8} />
          {busy ? "Байршуулж байна..." : imageUrl ? "Зураг солих" : "Зураг оруулах"}
        </button>

        {imageUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 px-4 text-theme-sm font-medium text-gray-600 transition-colors hover:bg-error-50 hover:text-error-600 disabled:opacity-60 dark:border-white/10 dark:text-gray-300 dark:hover:bg-error-500/10 dark:hover:text-error-400"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.8} />
            Устгах
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-theme-xs text-error-600 dark:text-error-400">
          {error}
        </p>
      )}
    </div>
  );
}
