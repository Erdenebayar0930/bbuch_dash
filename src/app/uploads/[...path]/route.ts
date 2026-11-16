import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

import { CONTENT_TYPES, statStored } from "@/lib/api/fileStore";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Сервер дээр хадгалсан файлыг түгээнэ (`/uploads/posts/<uid>/<uuid>.jpg`).
 *
 * Прод дээр Nginx энэ замыг дискнээс шууд өгдөг тул энд ихэвчлэн хүрэхгүй —
 * локал хөгжүүлэлт болон Nginx-гүй орчинд зориулсан нөөц зам. Видео гүйлгэхэд
 * хэрэгтэй `Range` хүсэлтийг дэмжинэ.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const relative = path.join("/");
  const info = await statStored(relative);
  if (!info) return new Response("Олдсонгүй.", { status: 404 });

  const ext = relative.slice(relative.lastIndexOf(".") + 1);
  const headers = new Headers({
    "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
    // Нэр бүр давтагдашгүй UUID — агуулга нь хэзээ ч өөрчлөгдөхгүй
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Last-Modified": info.mtime.toUTCString(),
  });

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  let start = 0;
  let end = info.size - 1;
  let status = 200;

  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), info.size - 1);
    } else {
      start = Math.max(0, info.size - Number(range[2]));
    }
    if (start > end || start >= info.size) {
      headers.set("Content-Range", `bytes */${info.size}`);
      return new Response(null, { status: 416, headers });
    }
    status = 206;
    headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
  }

  headers.set("Content-Length", String(end - start + 1));
  const stream = Readable.toWeb(createReadStream(info.full, { start, end })) as ReadableStream;
  return new Response(stream, { status, headers });
}
