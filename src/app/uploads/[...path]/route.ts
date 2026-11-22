import { createReadStream } from "node:fs";

import { CONTENT_TYPES, statStored } from "@/lib/api/fileStore";
import { derivedPaths, isSourceVideo, queueVideo, videoReady } from "@/lib/api/videoTranscode";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Файлын хэсгийг web stream болгоно — хэрэглэгч таслахад (бичлэг гүйлгэх,
 * хуудаснаас гарах) уншилтыг зогсоож, хаагдсан controller руу бичихгүй.
 *
 * `Readable.toWeb` нь тасалсны дараа ирсэн өгөгдлийг хаагдсан controller руу
 * бичиж «Controller is already closed» баригдаагүй алдаа шиддэг байсан.
 * Энд backpressure-ийг ч хүндэтгэнэ: буфер дүүрвэл уншилтыг түр зогсооно.
 */
function fileStream(full: string, start: number, end: number): ReadableStream<Uint8Array> {
  const node = createReadStream(full, { start, end, highWaterMark: 256 * 1024 });
  let done = false;

  const finish = () => {
    done = true;
    node.destroy();
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      node.on("data", (chunk) => {
        if (done) return;
        try {
          controller.enqueue(typeof chunk === "string" ? new TextEncoder().encode(chunk) : new Uint8Array(chunk));
          if ((controller.desiredSize ?? 1) <= 0) node.pause();
        } catch {
          finish();
        }
      });
      node.on("end", () => {
        if (done) return;
        done = true;
        try {
          controller.close();
        } catch {
          // Аль хэдийн хаагдсан — хэрэглэгч тасалсан
        }
      });
      node.on("error", (error) => {
        if (done) return;
        done = true;
        try {
          controller.error(error);
        } catch {
          // Аль хэдийн хаагдсан
        }
      });
    },
    pull() {
      if (!done) node.resume();
    },
    cancel() {
      finish();
    },
  });
}

/**
 * Сервер дээр хадгалсан файлыг түгээнэ (`/uploads/posts/<uid>/<uuid>.jpg`).
 *
 * Прод дээр Apache бүх хүсэлтийг энд дамжуулдаг (@see deploy). Видео гүйлгэхэд
 * хэрэгтэй `Range` хүсэлтийг дэмжинэ.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const requested = path.join("/");
  if (!(await statStored(requested))) return new Response("Олдсонгүй.", { status: 404 });

  // Эх бичлэгийн хаягаар ирвэл хөрвүүлсэн (утсанд тохирсон) хувилбарыг нь өгнө.
  // Бэлэн болтол эхийг өгч, кэшлүүлэхгүй — дараа нь хөрвүүлсэн нь солигдоно.
  const source = isSourceVideo(requested);
  const converted = source && videoReady(requested);
  if (source && !converted) queueVideo(requested);
  const relative = converted ? derivedPaths(requested).hd : requested;

  const info = await statStored(relative);
  if (!info) return new Response("Олдсонгүй.", { status: 404 });

  const ext = relative.slice(relative.lastIndexOf(".") + 1);
  const headers = new Headers({
    "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
    // Нэр бүр давтагдашгүй UUID — агуулга нь хэзээ ч өөрчлөгдөхгүй.
    // Эх бичлэгийн хаяг л үл хамаарна: түүний ард байх файл солигдож болно.
    "Cache-Control": source ? "public, no-cache" : "public, max-age=31536000, immutable",
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
  return new Response(fileStream(info.full, start, end), { status, headers });
}
