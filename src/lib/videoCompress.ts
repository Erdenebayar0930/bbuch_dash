"use client";

/**
 * Бичлэгийг ХӨТӨЧ ДОТОР шахна — сервер рүү юу ч илгээхгүй.
 *
 * Арга: бичлэгийг тоглуулж, кадр бүрийг жижигрүүлсэн canvas дээр зурна;
 * canvas ба дууны урсгалыг `MediaRecorder` руу өгч, шинэ битрэйтээр дахин
 * кодлоно. Бүх зүйл `URL.createObjectURL` дээр явагдана — файл RAM-аас
 * гардаггүй, сүлжээ огт хөндөгддөггүй.
 *
 * ⚠ ХЯЗГААР: MediaRecorder нь БОДИТ ХУГАЦААНД бичдэг тул 10 минутын бичлэг
 * ~10 минут шахагдана. Хуудсыг хаах, таб солих нь ажиллагааг тасалж болно.
 */

export type CompressPreset = {
  key: string;
  label: string;
  /** Өндрийн дээд хязгаар — өргөнийг харьцаагаар нь тооцно */
  maxHeight: number;
  /** Дүрсний битрэйт, бит/сек */
  videoBitsPerSecond: number;
  hint: string;
};

export const presets: CompressPreset[] = [
  {
    key: "high",
    label: "Өндөр — 1080p",
    maxHeight: 1080,
    videoBitsPerSecond: 2_500_000,
    hint: "Чанар бага зэрэг буурна, хэмжээ дунд зэрэг багасна",
  },
  {
    key: "medium",
    label: "Дунд — 720p",
    maxHeight: 720,
    videoBitsPerSecond: 1_200_000,
    hint: "Утсан дээр үзэхэд тохиромжтой. Ихэвчлэн энэ л хангалттай",
  },
  {
    key: "low",
    label: "Бага — 480p",
    maxHeight: 480,
    videoBitsPerSecond: 600_000,
    hint: "Хамгийн бага хэмжээ. Мессежээр илгээхэд",
  },
];

/** Дууны битрэйт — яриа сонсоход хангалттай */
const AUDIO_BITS_PER_SECOND = 96_000;

/** Зурах давтамж. Эх бичлэг үүнээс бага бол өөрөө буурна */
const FPS = 30;

/**
 * Хөтөч дэмждэг хамгийн сайн гаралтын хэлбэрийг сонгоно.
 *
 * MP4 нь хаана ч тоглодог тул эхэнд нь. Дэмжихгүй бол WebM — Chrome бүр
 * дэмждэг, гэхдээ зарим апп нээж чаддаггүй.
 */
export function pickMimeType(): string {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }

  return "";
}

/** Хөтөч энэ боломжийг дэмжиж байгаа эсэх */
export function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

export type VideoInfo = {
  width: number;
  height: number;
  /** Секундээр */
  duration: number;
};

/** Метадатаг уншина — хэмжээ, үргэлжлэх хугацааг харуулахад */
export function readVideoInfo(file: File): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const info = {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      };
      URL.revokeObjectURL(url);
      resolve(info);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Бичлэгийг уншиж чадсангүй."));
    };

    video.src = url;
  });
}

/**
 * Эх хэмжээнээс шахсан хэмжээг тооцно.
 *
 * Кодлогч тэгш тоо шаарддаг тул 2-т хуваагдахаар бөөрөнхийлнө — сондгой
 * өргөнтэй canvas дээр зарим кодлогч алдаа өгдөг.
 */
function targetSize(width: number, height: number, maxHeight: number) {
  const scale = height > maxHeight ? maxHeight / height : 1;
  const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);

  return { width: even(width * scale), height: even(height * scale) };
}

/**
 * Гаралтыг хүлээж авах суваг.
 *
 * Хэдэн ГБ-ын бичлэгийг санах ойд хуримтлуулж болохгүй — хэсэг бүрийг
 * ирмэгц нь дискэнд бичих боломж хэрэгтэй. Сувгаа өгөхгүй бол санах ойд
 * цуглуулна (богино бичлэгт л тохиромжтой).
 */
export type ChunkSink = {
  write: (chunk: Blob) => Promise<void>;
  close: () => Promise<void>;
  abort: () => Promise<void>;
};

/** File System Access API байгаа эсэх (Chrome/Edge, ширээний хувилбар) */
export function supportsFileSink(): boolean {
  return (
    typeof window !== "undefined" && "showSaveFilePicker" in window
  );
}

type SaveFilePicker = (options: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileSystemFileHandle>;

/**
 * Хэрэглэгчээс хадгалах байршил асууж, шууд бичих суваг үүсгэнэ.
 *
 * ЗААВАЛ хэрэглэгчийн товч дарсны дараа дуудагдана — эс бөгөөс хөтөч
 * цонхыг нээхгүй. Хэрэглэгч цуцалбал null.
 */
export async function createFileSink(
  suggestedName: string,
  mimeType: string
): Promise<ChunkSink | null> {
  if (!supportsFileSink()) return null;

  const picker = (window as unknown as { showSaveFilePicker: SaveFilePicker })
    .showSaveFilePicker;

  const extension = mimeType.includes("mp4") ? ".mp4" : ".webm";

  let handle: FileSystemFileHandle;
  try {
    handle = await picker({
      suggestedName,
      types: [
        {
          description: "Бичлэг",
          accept: { [mimeType.split(";")[0]]: [extension] },
        },
      ],
    });
  } catch {
    // Хэрэглэгч цуцаллаа
    return null;
  }

  const writable = await handle.createWritable();

  // Бичилтүүдийг дараалуулна: MediaRecorder хэсгүүдийг хурдан цувуулдаг ч
  // нэг writable дээр зэрэг бичих боломжгүй
  let queue: Promise<void> = Promise.resolve();

  return {
    write: (chunk) => {
      queue = queue.then(() => writable.write(chunk));
      return queue;
    },
    close: async () => {
      await queue;
      await writable.close();
    },
    abort: async () => {
      try {
        await writable.abort();
      } catch {
        // Аль хэдийн хаагдсан байж болно
      }
    },
  };
}

export type CompressResult = {
  /** Санах ойд цуглуулсан үед — сувгаар бичсэн бол null */
  blob: Blob | null;
  mimeType: string;
  width: number;
  height: number;
  /** Гаралтын нийт хэмжээ, байтаар */
  bytes: number;
};

export type CompressOptions = {
  onProgress: (ratio: number) => void;
  signal?: AbortSignal;
  /** Өгвөл хэсэг бүрийг ирмэгц нь энд бичнэ — санах ой хэмнэнэ */
  sink?: ChunkSink | null;
};

/**
 * Бичлэгийг шахна.
 *
 * @param onProgress 0..1 — тоглуулж буй байрлалаар тооцно
 * @param signal    Цуцлах бол — тоглуулалт зогсоод алдаа шиднэ
 * @param sink      Дискэнд шууд бичих суваг (том файлд заавал)
 */
export function compressVideo(
  file: File,
  preset: CompressPreset,
  { onProgress, signal, sink }: CompressOptions
): Promise<CompressResult> {
  return new Promise<CompressResult>((resolve, reject) => {
    if (!isSupported()) {
      reject(new Error("Энэ хөтөч бичлэг шахахыг дэмжихгүй байна."));
      return;
    }

    const mimeType = pickMimeType();
    if (!mimeType) {
      reject(new Error("Тохирох кодлогч олдсонгүй."));
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");

    video.src = url;
    video.playsInline = true;

    // ⚠ `muted = true` болговол Chrome нь MediaElementAudioSourceNode руу ч
    // чимээгүй өгдөг — шахсан бичлэг дуугүй гарна. Тиймээс дуугаар нь
    // тоглуулна; чанга яригч руу гарахаас нь audio graph өөрөө сэргийлнэ
    // (доор `destination` руу холбохгүй).

    let recorder: MediaRecorder | null = null;
    let audioContext: AudioContext | null = null;
    let frameHandle = 0;
    let finished = false;
    /** Нөөц зураачийг зогсооно — метадата уншсаны дараа жинхэнэ утга орно */
    let stopSafety = () => {};

    /** Бүх нөөцийг буцааж өгнө — хэдэн ч удаа дуудагдаж болно */
    const cleanup = () => {
      if (frameHandle) cancelAnimationFrame(frameHandle);
      stopSafety();
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close().catch(() => {});
      }
      signal?.removeEventListener("abort", onAbort);
    };

    const fail = (error: Error) => {
      if (finished) return;
      finished = true;
      cleanup();
      // Хагас бичсэн файлыг дискэн дээр үлдээхгүй
      sink?.abort().catch(() => {});
      reject(error);
    };

    function onAbort() {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      fail(new Error("Шахалтыг зогсоолоо."));
    }

    signal?.addEventListener("abort", onAbort);

    video.onerror = () => fail(new Error("Бичлэгийг нээж чадсангүй."));

    video.onloadedmetadata = () => {
      const size = targetSize(
        video.videoWidth,
        video.videoHeight,
        preset.maxHeight
      );

      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;

      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return fail(new Error("Canvas үүсгэж чадсангүй."));

      const stream = canvas.captureStream(FPS);

      // Дууг элементээс салгаж урсгал болгоно. `audioContext.destination`
      // руу ХОЛБОХГҮЙ — холбовол шахах явцад чанга яригчаар дуугарна.
      // Эсрэгээрээ, source node үүсмэгц элементийн дуу нь зөвхөн graph руу
      // урсдаг тул чимээгүй тоглоно.
      let hasAudio = false;

      try {
        const AudioCtor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;

        if (AudioCtor) {
          audioContext = new AudioCtor();
          const source = audioContext.createMediaElementSource(video);
          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);

          for (const track of destination.stream.getAudioTracks()) {
            stream.addTrack(track);
          }
          hasAudio = true;
        }
      } catch (error) {
        // Дуугүй бичлэг эсвэл хөтөч зөвшөөрөөгүй — дүрсийг нь шахсаар байна.
        // Graph үүсээгүй тул элемент чанга яригч руу гарна: чимээгүй болгоно.
        console.warn("Дууг салгаж чадсангүй, зөвхөн дүрс шахна:", error);
        video.muted = true;
      }

      /** Суваг байхгүй үед л ашиглана — хэдэн ГБ-ыг санах ойд барихгүй */
      const chunks: BlobPart[] = [];
      let bytes = 0;

      try {
        recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: preset.videoBitsPerSecond,
          audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        });
      } catch (error) {
        return fail(
          error instanceof Error ? error : new Error("Бичигч үүсгэж чадсангүй.")
        );
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size === 0) return;

        bytes += event.data.size;

        if (sink) {
          // Бичилт бүтэлгүйтвэл (диск дүүрсэн гэх мэт) шахалтыг зогсооно —
          // эс бөгөөс төгсгөлдөө гэмтсэн файл үлдэнэ
          sink.write(event.data).catch((error) => {
            console.error("Дискэнд бичихэд алдаа гарлаа:", error);
            if (recorder && recorder.state !== "inactive") recorder.stop();
            fail(new Error("Дискэнд бичиж чадсангүй. Зай хүрэлцэж байна уу?"));
          });
        } else {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => fail(new Error("Шахах явцад алдаа гарлаа."));

      recorder.onstop = () => {
        if (finished) return;
        finished = true;
        cleanup();

        if (bytes === 0) {
          sink?.abort().catch(() => {});
          reject(new Error("Шахсан файл хоосон гарлаа."));
          return;
        }

        const done = (blob: Blob | null) =>
          resolve({
            blob,
            mimeType,
            width: size.width,
            height: size.height,
            bytes,
          });

        if (sink) {
          sink
            .close()
            .then(() => done(null))
            .catch(() =>
              reject(new Error("Файлыг хааж чадсангүй — дахин оролдоно уу."))
            );
        } else {
          done(new Blob(chunks, { type: mimeType }));
        }
      };

      const paint = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (video.duration > 0) {
          onProgress(Math.min(1, video.currentTime / video.duration));
        }
      };

      const running = () => !video.paused && !video.ended && !finished;

      /**
       * Кадрын эх сурвалж.
       *
       * `requestVideoFrameCallback` нь ЖИНХЭНЭ декодлогдсон кадр гармагц
       * дуудагддаг тул илүү нарийн — байвал түүнийг хэрэглэнэ.
       */
      const withFrameCallback = "requestVideoFrameCallback" in video;

      const drawViaFrames = () => {
        paint();
        if (running()) {
          (
            video as HTMLVideoElement & {
              requestVideoFrameCallback: (cb: () => void) => number;
            }
          ).requestVideoFrameCallback(drawViaFrames);
        }
      };

      const drawViaRaf = () => {
        paint();
        if (running()) frameHandle = requestAnimationFrame(drawViaRaf);
      };

      /**
       * Нөөц зураач.
       *
       * Таб далд болоход хөтөч rAF болон rVFC-г зогсоодог — тэр үед canvas
       * шинэчлэгдэхээ болиод бичлэг хөлддөг мөртлөө дуу нь үргэлжилдэг.
       * `setInterval` нь далд табд секундэд нэг удаа болтлоо удаашрах ч
       * бүрэн зогсдоггүй тул наад зах нь зураг хөлдөхгүй.
       */
      const safety = window.setInterval(() => {
        if (document.visibilityState === "hidden" && running()) paint();
      }, 200);

      stopSafety = () => window.clearInterval(safety);

      video.onended = () => {
        onProgress(1);
        stopSafety();
        if (recorder && recorder.state !== "inactive") recorder.stop();
      };

      const begin = () => {
        // AudioContext нь ихэвчлэн `suspended` төлөвт үүсдэг — сэрээхгүй бол
        // урсгал руу чимээгүй өгнө
        audioContext?.resume().catch(() => {});
        recorder?.start(1000);

        if (withFrameCallback) drawViaFrames();
        else frameHandle = requestAnimationFrame(drawViaRaf);
      };

      video
        .play()
        .then(begin)
        .catch((error) => {
          // Хөтөч дуутай автомат тоглуулалтыг хориглосон бол чимээгүйгээр
          // дахин оролдоно — дуугүй ч гэсэн шахалт бүтсэн нь дээр
          if ((error as Error)?.name !== "NotAllowedError" || !hasAudio) {
            fail(
              error instanceof Error
                ? error
                : new Error("Бичлэгийг эхлүүлж чадсангүй.")
            );
            return;
          }

          console.warn("Дуутай тоглуулахыг зөвшөөрсөнгүй, чимээгүй шахна.");
          video.muted = true;
          video
            .play()
            .then(begin)
            .catch(() => fail(new Error("Бичлэгийг эхлүүлж чадсангүй.")));
        });
    };
  });
}

/**
 * Дэлгэц унтахаас сэргийлнэ.
 *
 * Хоёр цагийн шахалтын дундуур дэлгэц унтвал хөтөч таб-ыг удаашруулж,
 * MediaRecorder кадр алдаж эхэлдэг. Таб руу буцаж ирэхэд түгжээ суларсан
 * байж болох тул `visibilitychange` дээр дахин авна.
 *
 * Дэмждэггүй хөтөч дээр чимээгүй алгасна — шахалт зогсох шалтгаан биш.
 */
export function keepScreenAwake(): () => void {
  type WakeLockSentinel = { release: () => Promise<void> };
  type WakeLock = { request: (type: "screen") => Promise<WakeLockSentinel> };

  const api = (navigator as unknown as { wakeLock?: WakeLock }).wakeLock;
  if (!api) return () => {};

  let sentinel: WakeLockSentinel | null = null;
  let released = false;

  const acquire = () => {
    if (released || document.visibilityState !== "visible") return;

    api
      .request("screen")
      .then((next) => {
        if (released) next.release().catch(() => {});
        else sentinel = next;
      })
      .catch(() => {});
  };

  acquire();
  document.addEventListener("visibilitychange", acquire);

  return () => {
    released = true;
    document.removeEventListener("visibilitychange", acquire);
    sentinel?.release().catch(() => {});
    sentinel = null;
  };
}

/** «12.4 MB» хэлбэрээр */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** «1 ц 04 мин 12 сек» хэлбэрээр */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";

  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const pad = (value: number) => String(value).padStart(2, "0");

  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}