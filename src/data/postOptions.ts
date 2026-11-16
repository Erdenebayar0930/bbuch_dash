/** Нүүр хуудасны нийтлэлийн хязгаарууд — сервер ба клиент хоёул эндээс уншина. */

/** Нэг нийтлэлд хавсаргах файлын (зураг + видео) дээд тоо */
export const MAX_POST_MEDIA = 10;

/** Нийтлэлийн бичвэрийн дээд урт */
export const MAX_POST_LENGTH = 10_000;

/** Нэг зургийн дээд хэмжээ — storage.rules-тэй ижил байлгана */
export const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024;

/** Нэг видео файлын дээд хэмжээ — storage.rules-тэй ижил байлгана */
export const MAX_POST_VIDEO_BYTES = 100 * 1024 * 1024;

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

/** «5 минутын өмнө», «2026 оны 11-р сарын 16 14:05» г.м. */
export function formatPostTime(date: Date, now = new Date()): string {
  const diff = Math.max(0, now.getTime() - date.getTime());
  const minute = 60_000;
  if (diff < minute) return "Дөнгөж сая";
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} минутын өмнө`;
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))} цагийн өмнө`;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")} оны ${Number(get("month"))}-р сарын ${Number(get("day"))} ${get("hour")}:${get("minute")}`;
}

/**
 * Нийтлэлийн самбар — нүүр хуудас эсвэл Санхүүгийн «…талаар» табууд. Бүгд
 * нэг `posts` хүснэгтэд, `board` баганаар ялгагдана; зөвшөөрөл нь адилхан.
 */
export const POST_BOARDS = {
  home: { url: "/", label: "Нүүр" },
  donation: { url: "/finance/donations", label: "Хандивын талаар" },
  alms: { url: "/finance/alms", label: "Өглөгийн талаар" },
  supply: { url: "/finance/supply", label: "Хангамжийн талаар" },
} as const;

export type PostBoard = keyof typeof POST_BOARDS;

export const isPostBoard = (value: unknown): value is PostBoard =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(POST_BOARDS, value);
