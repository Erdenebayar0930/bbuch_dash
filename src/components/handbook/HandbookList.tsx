"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Download, FileText, Plus, Trash2, X } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import {
  createHandbookDocument,
  deleteHandbookDocument,
  listHandbookDocuments,
  type HandbookDocument,
} from "@/lib/handbook";
import { isAdminRole } from "@/lib/permissions";
import { deleteHandbookFile, uploadHandbookFile } from "@/lib/storage";

const sizeLabel = (bytes: number) => {
  if (bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
};

const dateFormatter = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/** Гарын авлагын баримтын жагсаалт — админ нэмж/устгана, бусад нь татна. */
export default function HandbookList() {
  const { user } = useUser();
  const canEdit = isAdminRole(user?.role);

  const [documents, setDocuments] = useState<HandbookDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = () => {
    setLoading(true);
    setError("");

    listHandbookDocuments()
      .then(setDocuments)
      .catch((err) => {
        console.error("Гарын авлага ачаалахад алдаа гарлаа:", err);
        setError("Ачаалахад алдаа гарлаа.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPendingFile(file);
    setTitle((prev) => prev || file.name.replace(/\.[^.]+$/, ""));
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingFile || !title.trim()) return;

    setUploading(true);
    setError("");

    try {
      const uploaded = await uploadHandbookFile(pendingFile);

      try {
        const created = await createHandbookDocument({
          title: title.trim(),
          description: description.trim(),
          fileUrl: uploaded.url,
          filePath: uploaded.path,
          fileName: pendingFile.name,
          fileSize: pendingFile.size,
        });
        setDocuments((prev) => [...prev, created]);
        setPendingFile(null);
        setTitle("");
        setDescription("");
      } catch (err) {
        // Бүртгэл бүтэлгүйтвэл эзэнгүй файл үлдээхгүй
        await deleteHandbookFile(uploaded.path).catch(() => {});
        throw err;
      }
    } catch (err) {
      console.error("Баримт байршуулахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Байршуулж чадсангүй.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: HandbookDocument) => {
    if (!window.confirm(`«${doc.title}» баримтыг устгах уу?`)) return;

    setBusyId(doc.id);
    setError("");

    try {
      const filePath = await deleteHandbookDocument(doc.id);
      await deleteHandbookFile(filePath).catch(() => {});
      setDocuments((prev) => prev.filter((item) => item.id !== doc.id));
    } catch (err) {
      console.error("Баримт устгахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Устгаж чадсангүй.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {canEdit && (
        <div className="surface p-5">
          <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
            Баримт нэмэх
          </h3>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.doc,.docx,.xls,.xlsx,image/*"
            className="hidden"
            onChange={handleFilePick}
          />

          {!pendingFile ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2 text-theme-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Файл сонгох
            </button>
          ) : (
            <form onSubmit={handleUpload} className="mt-3 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-theme-sm text-gray-600 dark:text-gray-300">
                <FileText className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                <span className="truncate">{pendingFile.name}</span>
                <button
                  type="button"
                  onClick={() => setPendingFile(null)}
                  aria-label="Цуцлах"
                  className="ml-auto flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Гарчиг"
                maxLength={255}
                required
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Тайлбар (заавал биш)"
                rows={2}
                className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90"
              />

              <button
                type="submit"
                disabled={uploading || !title.trim()}
                className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg bg-accent-600 px-4 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? "Байршуулж байна..." : "Байршуулах"}
              </button>
            </form>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      <div className="surface divide-y divide-gray-100 dark:divide-white/5">
        {loading && (
          <p className="px-5 py-10 text-center text-theme-sm text-gray-500">
            Ачаалж байна...
          </p>
        )}

        {!loading && documents.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <BookOpen
              className="h-9 w-9 text-gray-300 dark:text-gray-600"
              strokeWidth={1.5}
            />
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              Гарын авлага оруулаагүй байна.
            </p>
          </div>
        )}

        {documents.map((doc) => (
          <div
            key={doc.id}
            className={`flex items-center gap-3.5 px-5 py-4 ${
              busyId === doc.id ? "opacity-50" : ""
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">
              <FileText className="h-5 w-5" strokeWidth={1.8} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-theme-sm font-medium text-gray-900 dark:text-white">
                {doc.title}
              </p>
              {doc.description && (
                <p className="mt-0.5 truncate text-theme-xs text-gray-500 dark:text-gray-400">
                  {doc.description}
                </p>
              )}
              <p className="mt-0.5 text-theme-xs text-gray-400">
                {dateFormatter.format(doc.createdAt)}
                {doc.fileSize > 0 && ` · ${sizeLabel(doc.fileSize)}`}
              </p>
            </div>

            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${doc.title} татах`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
            >
              <Download className="h-4 w-4" strokeWidth={1.8} />
            </a>

            {canEdit && (
              <button
                type="button"
                onClick={() => handleDelete(doc)}
                disabled={busyId === doc.id}
                aria-label={`${doc.title} устгах`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-error-500 transition-colors hover:bg-error-50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-error-500/10"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
