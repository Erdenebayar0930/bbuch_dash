/** Нүүр хуудасны нийтлэлийн хязгаарууд — сервер ба клиент хоёул эндээс уншина. */

/** Нэг нийтлэлд хавсаргах файлын (зураг + видео + баримт) дээд тоо */
export const MAX_POST_MEDIA = 10;

/** Нийтлэлийн бичвэрийн дээд урт */
export const MAX_POST_LENGTH = 10_000;

/** Нэг зургийн дээд хэмжээ — storage.rules-тэй ижил байлгана */
export const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024;

/** Нэг видео файлын дээд хэмжээ — storage.rules-тэй ижил байлгана */
export const MAX_POST_VIDEO_BYTES = 200 * 1024 * 1024;

/** Хавсралт баримтын (PDF, Word, Excel, PowerPoint) дээд хэмжээ */
export const MAX_POST_FILE_BYTES = 25 * 1024 * 1024;

/** Хавсаргаж болох баримтын төрлүүд — сервер (lib/api/fileStore.ts) ч мөн шалгана */
export const POST_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

/** `<input accept>` — зарим утас MIME-ээр биш өргөтгөлөөр шүүдэг */
export const POST_FILE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx," + POST_FILE_TYPES.join(",");

/** Хавсралтын нэрийн дээд урт */
export const MAX_POST_FILE_NAME = 200;

/** 1536000 → «1.5 MB» */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Видео холбоосын дээд урт — баазын varchar(500)-тэй ижил */
export const MAX_POST_LINK_LENGTH = 500;

export type VideoEmbed = { provider: "youtube" | "facebook"; embedUrl: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * YouTube/Facebook видеоны холбоосыг iframe-д тавих хаяг болгоно. Танихгүй
 * холбоос бол null — сервер ч мөн үүгээр шалгаж, өөр сайтыг суулгахгүй.
 */
export function parseVideoLink(value: string): VideoEmbed | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.replace(/^(www\.|m\.)/, "");

  if (host === "youtube.com" || host === "youtu.be" || host === "music.youtube.com") {
    let id = "";
    if (host === "youtu.be") {
      id = url.pathname.slice(1).split("/")[0];
    } else if (url.pathname === "/watch") {
      id = url.searchParams.get("v") ?? "";
    } else {
      const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/);
      id = match?.[1] ?? "";
    }
    return YOUTUBE_ID.test(id)
      ? { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` }
      : null;
  }

  if (host === "facebook.com" || host === "fb.watch") {
    url.protocol = "https:";
    return {
      provider: "facebook",
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
        url.toString()
      )}&show_text=false`,
    };
  }

  return null;
}

/** Нийтлэлийн огноо — `YYYY-MM-DD` (өмнөх хувилбарын `YYYY-MM` ч хүчинтэй) */
export const POST_PERIOD = /^(\d{4})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/;

/** Он сар сонгох доод хязгаар */
export const POST_PERIOD_MIN_YEAR = 2000;

/** Улаанбаатарын цагийн бүс (UTC+8, зуны цаг байхгүй) */
const UB_OFFSET_MS = 8 * 3_600_000;

/** Огнооны түлхүүр `YYYY-MM-DD` — Улаанбаатарын цагаар */
export const postDateKey = (date: Date) => new Date(date.getTime() + UB_OFFSET_MS).toISOString().slice(0, 10);

/** Өнөөдөр (Улаанбаатар) — нийтлэлийн огнооны анхдагч утга */
export const todayKey = () => postDateKey(new Date());

/** `2025-03-14` эсвэл (зөвхөн он сар бол) `2025-03` — огнооны нэг формат (@see lib/dateFormat.ts) */
export function formatPostPeriod(period: string): string {
  return POST_PERIOD.test(period) ? period : "";
}

/**
 * Нийтлэлийн самбар — нүүр хуудас эсвэл Санхүүгийн «…талаар» табууд. Бүгд
 * нэг `posts` хүснэгтэд, `board` баганаар ялгагдана; зөвшөөрөл нь адилхан.
 */
export const POST_BOARDS = {
  home: { url: "/", label: "Нүүр" },
  tithe: { url: "/finance/allocation", label: "1/10 ба өргөлийн талаар" },
  land: { url: "/finance/land-tithe", label: "Газрын 1/10-ийн талаар" },
  "tithe-giving": { url: "/finance/allocation", label: "1/10 ба өргөл: Өргөж буй байдал" },
  "land-giving": { url: "/finance/land-tithe", label: "Газрын 1/10: Өргөж буй байдал" },
  "guard-map-revealed": { url: "/aimag/guard/map", label: "Илчлэгдсэн үйлчлэл" },
  "guard-map-done": { url: "/aimag/guard/map", label: "Гүйцэтгэсэн үйлчлэл" },
  "guard-duty": { url: "/aimag/guard/duty", label: "Харуулын үүрэгт зогсох" },
  "praise-hall": { url: "/aimag/praise/hall", label: "Асрын үйлчлэл" },
  "commission-az": { url: "/aimag/commission/az", label: "АЗ-ийн үйлчлэл" },
  "commission-aah": { url: "/aimag/commission/aah", label: "ААХ-ийн үйлчлэл" },
  "service-services": { url: "/aimag/service/services", label: "Туслах үйлчлэлүүд" },
  "service-projects": { url: "/aimag/service/projects", label: "Төслүүд" },
  "supply-kingdom": { url: "/aimag/supply/kingdom", label: "Хаанчлалын хангамж" },
  donation: { url: "/finance/donations", label: "Хандивын талаар" },
  alms: { url: "/finance/alms", label: "Өглөгийн талаар" },
  supply: { url: "/finance/supply", label: "Хангамжийн талаар" },
} as const;

export type PostBoard = keyof typeof POST_BOARDS;

export const isPostBoard = (value: unknown): value is PostBoard =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(POST_BOARDS, value);
