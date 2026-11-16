import "server-only";

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { rename, rm } from "node:fs/promises";
import path from "node:path";

import { publicUrl, resolveStored } from "@/lib/api/fileStore";

/**
 * Байршуулсан бичлэгийг утсанд тохирсон, YouTube шиг шууд тоглогдох хэлбэрт
 * хөрвүүлнэ — сервер дээр, дэвсгэрт.
 *
 * Нэг бичлэгээс:
 *   `<нэр>-720.mp4`   — үндсэн чанар (богино тал нь ≤ 720px), ~2.5 Mbit/s
 *   `<нэр>-360.mp4`   — удаан сүлжээнд (богино тал нь ≤ 360px), ~0.8 Mbit/s
 *   `<нэр>-poster.jpg` — тоглуулахаас өмнө харагдах зураг
 *
 * Бүгд H.264 + AAC, `faststart` — татаж дуусахаас өмнө тоглож эхэлнэ, iPhone,
 * Android, хөтөч бүрт ажиллана (MOV, HEVC зэрэг утасны эх файл олон хөтөчид
 * тоглогддоггүй). Эх файл устгагдахгүй — хөрвүүлж дуустал тэр нь тоглогдоно.
 *
 * Сервер 2 цөмтэй тул НЭГ удаад нэг л бичлэг, бага эрэмбээр (`nice`)
 * хөрвүүлнэ — сайтын хариу удаашрахгүй. Процесс дахин асахад дараалал
 * алдагдана; тэр үед бичлэгийг хэн нэгэн нээхэд дахин дараалалд орно
 * (@see app/uploads/[...path]/route.ts, app/api/files/video/route.ts).
 */

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|3gp)$/;

/** Хөрвүүлсэн файлын төгсгөл — эдгээрийг дахин хөрвүүлэхгүй */
const DERIVED = /-(720|360)\.mp4$|-poster\.jpg$/;

/** Нийтлэлийн эх бичлэг мөн эсэх (хөрвүүлсэн хувилбар биш) */
export const isSourceVideo = (relative: string) =>
  relative.startsWith("posts/") && VIDEO_EXT.test(relative) && !DERIVED.test(relative);

const base = (relative: string) => relative.replace(VIDEO_EXT, "");

export const derivedPaths = (relative: string) => ({
  hd: `${base(relative)}-720.mp4`,
  sd: `${base(relative)}-360.mp4`,
  poster: `${base(relative)}-poster.jpg`,
});

type Queue = { pending: string[]; active: string | null; failed: Map<string, number> };

const emptyQueue = (): Queue => ({ pending: [], active: null, failed: new Map() });

/** Dev дээр HMR модулийг дахин ачаалахад дараалал давхардахгүй */
const holder = globalThis as { __videoQueue?: Queue };
const state: Queue = (holder.__videoQueue ??= emptyQueue());

/** Нэг бичлэгт зарцуулах дээд хугацаа — гацсан ffmpeg-ийг зогсооно */
const TIMEOUT_MS = 40 * 60 * 1000;

/** Амжилтгүй болсон бичлэгийг дахин оролдох хүртэлх хугацаа */
const RETRY_AFTER_MS = 6 * 60 * 60 * 1000;

function ffmpegPath(): string | null {
  const found = require("ffmpeg-static") as string | null;
  return found && existsSync(found) ? found : null;
}

function run(args: string[]): Promise<void> {
  const binary = ffmpegPath();
  if (!binary) return Promise.reject(new Error("ffmpeg олдсонгүй."));

  // Linux дээр бага эрэмбээр — вэб хүсэлтүүд түрүүлж CPU авна
  const [command, commandArgs] =
    process.platform === "win32" ? [binary, args] : ["nice", ["-n", "15", binary, ...args]];

  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: ["ignore", "ignore", "pipe"] });
    let tail = "";
    child.stderr.on("data", (chunk: Buffer) => {
      tail = (tail + chunk.toString()).slice(-2000);
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg ${code}: ${tail.trim().split("\n").slice(-3).join(" | ")}`));
    });
  });
}

/** Богино тал нь `size`-аас хэтрэхгүй (босоо утасны бичлэг ч зөв чанартай) */
const scaleTo = (size: number) =>
  `scale='if(gt(iw,ih),-2,min(${size},iw))':'if(gt(iw,ih),min(${size},ih),-2)'`;

const rendition = (input: string, output: string, size: number, crf: number, maxrate: string, audio: string) => [
  "-hide_banner", "-loglevel", "error", "-y",
  "-i", input,
  "-map", "0:v:0", "-map", "0:a:0?",
  "-vf", scaleTo(size),
  "-c:v", "libx264", "-preset", "veryfast", "-crf", String(crf),
  "-maxrate", maxrate, "-bufsize", maxrate.replace(/\d+/, (n) => String(Number(n) * 2)),
  "-profile:v", "main", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", audio, "-ac", "2",
  "-movflags", "+faststart",
  "-threads", "2",
  "-f", "mp4", output,
];

async function transcode(relative: string): Promise<void> {
  const input = resolveStored(relative);
  if (!input || !existsSync(input)) return;

  const out = derivedPaths(relative);
  const steps: { target: string; args: (tmp: string) => string[] }[] = [
    {
      // Зураг эхэлж — бичлэг хөрвүүлж дуустал ч жагсаалтад харагдана
      target: out.poster,
      args: (tmp) => [
        "-hide_banner", "-loglevel", "error", "-y",
        "-ss", "1", "-i", input, "-frames:v", "1",
        "-vf", scaleTo(720), "-q:v", "4", "-f", "image2", tmp,
      ],
    },
    { target: out.sd, args: (tmp) => rendition(input, tmp, 360, 28, "800k", "96k") },
    { target: out.hd, args: (tmp) => rendition(input, tmp, 720, 26, "2500k", "128k") },
  ];

  for (const step of steps) {
    const final = resolveStored(step.target);
    if (!final || existsSync(final)) continue;
    const tmp = path.join(path.dirname(final), `.${path.basename(final)}.part`);
    try {
      await run(step.args(tmp));
      await rename(tmp, final);
    } catch (error) {
      await rm(tmp, { force: true });
      // 1 секундээс богино бичлэг — эхний кадраас зураг авна
      if (step.target === out.poster) {
        try {
          await run(step.args(tmp).map((arg, i, all) => (all[i - 1] === "-ss" ? "0" : arg)));
          await rename(tmp, final);
          continue;
        } catch {
          await rm(tmp, { force: true });
        }
      }
      throw error;
    }
  }
}

async function drain() {
  if (state.active) return;
  const next = state.pending.shift();
  if (!next) return;

  state.active = next;
  const started = Date.now();
  try {
    await transcode(next);
    state.failed.delete(next);
    console.info(`Бичлэг хөрвүүлэв: ${next} (${Math.round((Date.now() - started) / 1000)}с)`);
  } catch (error) {
    state.failed.set(next, Date.now());
    console.error(`Бичлэг хөрвүүлж чадсангүй: ${next}`, error);
  } finally {
    state.active = null;
    void drain();
  }
}

/** Бичлэгийг хөрвүүлэх дараалалд оруулна (аль хэдийн байгаа/хийгдсэн бол юу ч хийхгүй). */
export function queueVideo(relative: string): void {
  if (!isSourceVideo(relative) || videoReady(relative)) return;
  if (state.active === relative || state.pending.includes(relative)) return;
  const failedAt = state.failed.get(relative);
  if (failedAt && Date.now() - failedAt < RETRY_AFTER_MS) return;
  state.pending.push(relative);
  void drain();
}

/** 720p хувилбар бэлэн эсэх */
export function videoReady(relative: string): boolean {
  const hd = resolveStored(derivedPaths(relative).hd);
  return !!hd && existsSync(hd);
}

export type VideoInfo = {
  status: "ready" | "processing" | "failed";
  /** Чанарын сонголт — эхнийх нь анхдагч */
  sources: { label: string; url: string }[];
  poster: string | null;
};

/** Тоглуулагчид — аль хувилбар бэлэн, зураг байгаа эсэх. Бэлэн биш бол дараалалд оруулна. */
export function videoInfo(relative: string): VideoInfo {
  const out = derivedPaths(relative);
  const has = (p: string) => {
    const full = resolveStored(p);
    return !!full && existsSync(full);
  };

  const sources: VideoInfo["sources"] = [];
  if (has(out.hd)) sources.push({ label: "720p", url: publicUrl(out.hd) });
  if (has(out.sd)) sources.push({ label: "360p", url: publicUrl(out.sd) });

  const ready = sources.some((source) => source.label === "720p");
  if (!ready) {
    queueVideo(relative);
    sources.push({ label: "Эх", url: publicUrl(relative) });
  }

  return {
    status: ready ? "ready" : state.failed.has(relative) ? "failed" : "processing",
    sources,
    poster: has(out.poster) ? publicUrl(out.poster) : null,
  };
}

/** Эх бичлэгийг устгахад хөрвүүлсэн хувилбаруудыг нь хамт цэвэрлэнэ. */
export async function removeDerived(relative: string): Promise<void> {
  if (!isSourceVideo(relative)) return;
  for (const p of Object.values(derivedPaths(relative))) {
    const full = resolveStored(p);
    if (full) await rm(full, { force: true });
  }
}
