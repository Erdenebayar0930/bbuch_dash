"use client";

import { auth } from "./firebase";

/** Хариунаас файлын нэрийг гаргана — байхгүй бол нөөц нэр */
function fileNameFrom(header: string | null, fallback: string) {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

/**
 * Бүртгэлийг .xlsx болгон татаж авна.
 *
 * `apiFetch` нь JSON хүлээдэг тул хоёртын файлд тохирохгүй — энд хариуг blob
 * болгож аваад түр холбоосоор татуулна.
 */
export async function downloadExport(dataset: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Нэвтэрсэн байх шаардлагатай.");

  const response = await fetch(`/api/export/${dataset}`, {
    headers: { Authorization: `Bearer ${await currentUser.getIdToken()}` },
  });

  if (!response.ok) {
    // Алдааны хариу нь JSON — уншиж чадвал серверийн мессежийг харуулна
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(payload.error || `Татаж чадсангүй (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileNameFrom(
      response.headers.get("Content-Disposition"),
      `${dataset}.xlsx`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Татаж эхэлсний дараа объектын хаягийг чөлөөлнө — эс бөгөөс санах ойд үлдэнэ
    URL.revokeObjectURL(url);
  }
}