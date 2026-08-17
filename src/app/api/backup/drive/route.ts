import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { badRequest, requireSuper, serverError } from "@/lib/api/auth";
import { DRIVE_KEYS, getSetting, removeSettings, setSettings } from "@/lib/backup/settings";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `drive.file` — энэ апп ӨӨРӨӨ үүсгэсэн файлд л хандана.
 *
 * Бүтэн `drive` эрх авбал хэрэглэгчийн Drive дээрх БҮХ файл нээгдэнэ.
 * Нөөцлөлтөд тэр хэрэггүй: бид зөвхөн өөрсдийн үүсгэсэн фолдер, архивыг
 * удирдана. Эрхийг хамгийн бага байлгах нь токен алдагдсан үеийн хохирлыг
 * шууд багасгана.
 */
const SCOPE = "https://www.googleapis.com/auth/drive.file";

/**
 * Зөвшөөрлийн код буцаж ирэх хаяг — Google Console дээр ЯГ ийм байх ёстой.
 *
 * ⚠ Route файлаас ЭКСПОРТЛОХГҮЙ: Next.js нь route модулиас зөвхөн HTTP
 * методууд болон тодорхой тохиргоог зөвшөөрдөг, бусад экспорт нь build-ийн
 * төрлийн шалгалтыг унагаана.
 */
function redirectUri(request: NextRequest): string {
  return new URL("/api/backup/drive/callback", request.nextUrl.origin).toString();
}

/** Холболтын одоогийн төлөв — дэлгэцэд харуулна. Нууц утга ХЭЗЭЭ Ч гарахгүй. */
export async function GET(request: NextRequest) {
  const auth = await requireSuper(request);
  if ("error" in auth) return auth.error;

  try {
    const [clientId, refreshToken, folderName, account] = await Promise.all([
      getSetting(DRIVE_KEYS.clientId),
      getSetting(DRIVE_KEYS.refreshToken),
      getSetting(DRIVE_KEYS.folderName),
      getSetting(DRIVE_KEYS.account),
    ]);

    return NextResponse.json({
      connected: Boolean(refreshToken),
      /** Client ID нь нууц биш — дэлгэцэд буцааж харуулахад ашиглана */
      clientId: clientId ?? "",
      folderName: folderName ?? "",
      account: account ?? "",
      /** Google Console-д бүртгүүлэх ёстой хаяг — хуулж тавихад хэрэгтэй */
      redirectUri: redirectUri(request),
    });
  } catch (error) {
    return serverError(error, "Drive-ийн төлөв уншихад алдаа гарлаа");
  }
}

/**
 * Client ID/secret хадгалаад, зөвшөөрлийн холбоосыг буцаана.
 *
 * Холбоос руу ШИЛЖИХИЙГ клиент өөрөө хийнэ — сервер 302 буцаавал `fetch`
 * түүнийг чимээгүй дагаж, хэрэглэгч Google дээр очих ёстойгоо мэдэхгүй үлдэнэ.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuper(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const clientId = String(body.clientId ?? "").trim();
    const clientSecret = String(body.clientSecret ?? "").trim();

    if (!clientId || !clientSecret) {
      return badRequest("Client ID болон Client secret шаардлагатай.");
    }

    /**
     * CSRF хамгаалалт: санамсаргүй `state` үүсгэж БААЗАД хадгална.
     *
     * Санах ойд хадгалж болохгүй — Passenger нь олон процесс ажиллуулдаг тул
     * зөвшөөрөл өгөөд буцаж ирэх хүсэлт өөр процесс дээр буух боломжтой.
     * Баазад байвал аль процесс ч шалгаж чадна.
     */
    const state = randomBytes(24).toString("hex");

    await setSettings({
      [DRIVE_KEYS.clientId]: clientId,
      [DRIVE_KEYS.clientSecret]: clientSecret,
      // Хугацаа нь давхар хамгаалалт — хуучирсан state ажиллахгүй
      [DRIVE_KEYS.state]: JSON.stringify({ state, at: Date.now() }),
    });

    const url =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri(request),
        response_type: "code",
        scope: SCOPE,
        // refresh token авахын тулд хоёулаа ЗААВАЛ хэрэгтэй:
        // offline — refresh token өг, consent — өмнө зөвшөөрсөн ч дахин өг
        access_type: "offline",
        prompt: "consent",
        state,
      });

    return NextResponse.json({ url });
  } catch (error) {
    return serverError(error, "Зөвшөөрлийн холбоос үүсгэхэд алдаа гарлаа");
  }
}

/**
 * Холболтыг салгана.
 *
 * Client ID/secret-ийг ҮЛДЭЭНЭ: дахин холбоход тэднийг дахин бичих
 * шаардлагагүй байх нь тав тухтай бөгөөд тэдгээр нь өөрсдөө хандалт өгдөггүй.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireSuper(request);
  if ("error" in auth) return auth.error;

  try {
    await removeSettings([
      DRIVE_KEYS.refreshToken,
      DRIVE_KEYS.folderId,
      DRIVE_KEYS.folderName,
      DRIVE_KEYS.account,
      DRIVE_KEYS.state,
    ]);

    return NextResponse.json({ connected: false });
  } catch (error) {
    return serverError(error, "Холболтыг салгахад алдаа гарлаа");
  }
}
