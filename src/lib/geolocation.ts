"use client";

/** Хөтчөөс уншсан байршил */
export type Coords = {
  lat: number;
  lng: number;
  /** Нарийвчлал, метрээр — хэр итгэж болохыг харуулна */
  accuracy: number;
};

/**
 * Хөтөч байршил тогтоохыг дэмжиж байгаа эсэх.
 *
 * Geolocation нь ЗӨВХӨН secure context дээр ажиллана (https эсвэл localhost) —
 * http дээр нээсэн бол `navigator.geolocation` огт байхгүй байж болно.
 *
 * ⚠ Үүнийг рендерийн үед бүү дууд: сервер дээр `navigator` байхгүй тул хариу
 * нь клиенттэй зөрж hydration алдаа өгнө. Товчийг үргэлж харуулаад, дарсны
 * дараа `getCurrentCoords`-ийн алдаанаас дэмжлэггүйг мэдэж болно.
 */
const isSupported = () =>
  typeof navigator !== "undefined" && "geolocation" in navigator;

/** Алдааны кодыг ойлгомжтой мессеж болгоно */
function messageFor(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Байршил тогтоох зөвшөөрөл өгөгдөөгүй байна. Хөтчийн тохиргооноос зөвшөөрнө үү.";
    case error.POSITION_UNAVAILABLE:
      return "Байршлыг тогтоож чадсангүй. GPS эсвэл сүлжээгээ шалгана уу.";
    case error.TIMEOUT:
      return "Байршил тогтооход хугацаа хэтэрлээ. Дахин оролдоно уу.";
    default:
      return "Байршил тогтооход алдаа гарлаа.";
  }
}

/** Хүлээх дээд хугацаа — гадаа GPS барихад хэдэн секунд шаардагдана */
const TIMEOUT_MS = 15_000;

/**
 * Одоогийн байршлыг нэг удаа уншина.
 *
 * `enableHighAccuracy` нь GPS-ийг асаана — талбар дээр өрхийн хаалганы өмнө
 * зогсож байхад сүлжээний ойролцоо байршил хангалтгүй.
 */
export function getCurrentCoords(): Promise<Coords> {
  if (!isSupported()) {
    return Promise.reject(
      new Error(
        "Энэ хөтөч байршил тогтоохыг дэмжихгүй байна. HTTPS холбоосоор нэвтэрч үзнэ үү."
      )
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) => reject(new Error(messageFor(error))),
      {
        enableHighAccuracy: true,
        timeout: TIMEOUT_MS,
        // Хуучин уншилтыг дахин ашиглахгүй — байршил нь яг одоогийнх байх ёстой
        maximumAge: 0,
      }
    );
  });
}