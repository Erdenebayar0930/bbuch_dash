import { NextResponse } from "next/server";

import { accountEmail, ensureFolder, exchangeCode } from "@/lib/backup/drive";
import {
  DRIVE_KEYS,
  getSetting,
  removeSetting,
  setSettings,
} from "@/lib/backup/settings";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Нөөцлөлт хадгалах фолдерын нэр — Drive дээр ингэж харагдана */
const FOLDER_NAME = "Бид туслая — нөөцлөлт";

/** `state` хэдэн хугацаанд хүчинтэй вэ */
const STATE_TTL_MS = 15 * 60_000;

/** Хэрэглэгчийг нөөцлөлтийн хуудас руу үр дүнтэй нь буцаана */
function back(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/backup", request.nextUrl.origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

/**
 * Google-ээс зөвшөөрлийн код буцаж ирэх цэг.
 *
 * ⚠ ЭНЭ ХҮСЭЛТ НЬ НЭВТРЭЛТГҮЙ ИРНЭ. Хөтөч Google-ээс шилжиж ирэх тул манай
 * `Authorization: Bearer` толгой байхгүй — `requireSuper` ашиглах боломжгүй.
 * Эрхийн баталгаа нь `state`: түүнийг зөвхөн нэвтэрсэн супер админ үүсгэж
 * чадна, нэг л удаа хүчинтэй, 15 минутын дараа хугацаа нь дуусна.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if (error) return back(request, { drive: "error", reason: error });
  if (!code || !state) return back(request, { drive: "error", reason: "no-code" });

  try {
    const raw = await getSetting(DRIVE_KEYS.state);
    // Нэг удаагийн хэрэглээ — амжилттай эсэхээс үл хамааран шууд устгана
    await removeSetting(DRIVE_KEYS.state);

    if (!raw) return back(request, { drive: "error", reason: "state-missing" });

    const saved = JSON.parse(raw) as { state?: string; at?: number };

    if (saved.state !== state) {
      return back(request, { drive: "error", reason: "state-mismatch" });
    }

    if (!saved.at || Date.now() - saved.at > STATE_TTL_MS) {
      return back(request, { drive: "error", reason: "state-expired" });
    }

    const [clientId, clientSecret] = await Promise.all([
      getSetting(DRIVE_KEYS.clientId),
      getSetting(DRIVE_KEYS.clientSecret),
    ]);

    if (!clientId || !clientSecret) {
      return back(request, { drive: "error", reason: "no-client" });
    }

    const redirectUri = new URL(
      "/api/backup/drive/callback",
      request.nextUrl.origin
    ).toString();

    const { refreshToken, accessToken } = await exchangeCode(
      clientId,
      clientSecret,
      code,
      redirectUri
    );

    /**
     * Фолдерыг апп өөрөө үүсгэнэ — хэрэглэгчээс ID гуйхгүй.
     *
     * Энэ бол тохиргоог хамгийн ихээр хялбарчилсан алхам: Drive рүү орж,
     * фолдер үүсгээд, хаягийн мөрнөөс ID хуулах шаардлагагүй болно.
     */
    const folder = await ensureFolder(accessToken, FOLDER_NAME);
    const account = await accountEmail(accessToken);

    await setSettings({
      [DRIVE_KEYS.refreshToken]: refreshToken,
      [DRIVE_KEYS.folderId]: folder.id,
      [DRIVE_KEYS.folderName]: folder.name,
      [DRIVE_KEYS.account]: account,
    });

    return back(request, { drive: "connected" });
  } catch (err) {
    console.error("[drive] холбоход алдаа гарлаа:", err);
    return back(request, {
      drive: "error",
      reason: err instanceof Error ? err.message.slice(0, 120) : "unknown",
    });
  }
}
