import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { DRIVE_KEYS, getSetting } from "./settings";

/**
 * Google Drive-ийн хамгийн бага клиент — REST API руу шууд.
 *
 * ЯАГААД `googleapis` БАГЦ БИШ ВЭ: тэр багц нь Google-ийн БҮХ үйлчилгээний
 * тодорхойлолтыг агуулдаг тул хэдэн зуун MB болдог. Бидэнд ердөө дөрөв
 * үйлдэл хэрэгтэй (байршуулах, жагсаах, устгах, татах) — эдгээрийг `fetch`-ээр
 * бичих нь хамаарлыг ч, халдлагын гадаргууг ч бага байлгана.
 *
 * ЯАГААД SERVICE ACCOUNT БИШ ВЭ: Google 2021 оноос хойш service account-д
 * Drive-ийн хадгалах багтаамж олгохоо больсон. Хэрэглэгчийн фолдерыг
 * хуваалцсан ч байршуулах үед `storageQuotaExceeded` алдаа өгнө. Тиймээс
 * жинхэнэ хэрэглэгчийн нэрийн өмнөөс ажиллах refresh token хэрэгтэй —
 * файлууд тухайн хүний Drive-д, түүний багтаамжид үүснэ.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export type DriveConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
};

/**
 * Тохиргоог БААЗААС уншина.
 *
 * ЯАГААД ENV-ЭЭС БИШ ВЭ: холболтыг админы дэлгэцээс хийдэг болсон. Refresh
 * token нь OAuth урсгалын дунд үүсдэг тул тэр агшинд орчны хувьсагч бичих
 * боломжгүй — hPanel руу гараар оруулах алхам гарч ирнэ. Баазад хадгалснаар
 * бүх тохиргоо нэг товчоор бүрддэг.
 */
export async function driveConfig(): Promise<DriveConfig | null> {
  const [clientId, clientSecret, refreshToken, folderId] = await Promise.all([
    getSetting(DRIVE_KEYS.clientId),
    getSetting(DRIVE_KEYS.clientSecret),
    getSetting(DRIVE_KEYS.refreshToken),
    getSetting(DRIVE_KEYS.folderId),
  ]);

  if (!clientId || !clientSecret || !refreshToken || !folderId) return null;

  return { clientId, clientSecret, refreshToken, folderId };
}

async function requireConfig(): Promise<DriveConfig> {
  const config = await driveConfig();

  if (!config) {
    throw new Error(
      "Google Drive холбогдоогүй байна. Нөөцлөлт хуудсаас «Google Drive холбох» " +
        "товчийг дарж холбоно уу."
    );
  }

  return config;
}

/**
 * Зөвшөөрлийн код → refresh token.
 *
 * Холбох урсгалд НЭГ УДАА дуудагдана. Энд `driveConfig`-ийг ашиглахгүй:
 * refresh token хараахан байхгүй учир тэр `null` буцаана.
 */
export async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<{ refreshToken: string; accessToken: string }> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.refresh_token || !data.access_token) {
    throw new Error(
      data.error_description ??
        data.error ??
        `Токен солиход алдаа гарлаа (${response.status})`
    );
  }

  return { refreshToken: data.refresh_token, accessToken: data.access_token };
}

/**
 * Access token-ы кэш.
 *
 * Токен 1 цаг хүчинтэй. Үйлдэл бүрд шинээр солиулбал Google руу илүү дуудлага
 * явж, нөөцлөлт удаашрахаас гадна квот дэмий зарцуулагдана. 60 секундын
 * нөөцтэйгээр дуусах хугацааг барина.
 *
 * ⚠ Кэшийг REFRESH TOKEN-оор түлхүүрлэнэ. Салгаад өөр дансаар дахин холбоход
 * refresh token солигдоно — түлхүүрлэхгүй бол хуучин дансны access token
 * нэг цаг хүртэл хүчинтэй хэвээр байж, нөөцлөлт ХУУЧИН данс руу үргэлжлэн
 * очно. Мөн Passenger-ийн процесс бүр өөрийн кэштэй тул тэднийг гаднаас
 * зохицуулах арга байхгүй — түлхүүрлэлт нь тэр асуудлыг ч шийднэ.
 */
let cached: { token: string; expiresAt: number; forRefreshToken: string } | null =
  null;

async function accessToken(): Promise<string> {
  const config = await requireConfig();

  if (
    cached &&
    cached.expiresAt > Date.now() &&
    cached.forRefreshToken === config.refreshToken
  ) {
    return cached.token;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    /**
     * `invalid_grant` нь бараг үргэлж нэг л зүйлийг хэлнэ: refresh token
     * хүчингүй болсон (зөвшөөрөл цуцлагдсан, эсвэл 6 сар ашиглагдаагүй).
     * Шалтгааныг тайлбарлахгүй бол "нөөцлөлт ажиллахаа больсон" гэсэн
     * ойлгомжгүй байдалд хүрнэ.
     */
    const hint =
      data.error === "invalid_grant"
        ? " — зөвшөөрөл хүчингүй болсон байна. Нөөцлөлт хуудаснаас Drive-ыг дахин холбоно уу."
        : "";

    throw new Error(
      `Google Drive-ийн токен авч чадсангүй (${data.error ?? response.status})${hint}`
    );
  }

  cached = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000,
    forRefreshToken: config.refreshToken,
  };

  return cached.token;
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();

  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Google Drive алдаа (${response.status}): ${text.slice(0, 200)}`
    );
  }

  return response;
}

export type DriveFile = {
  id: string;
  name: string;
  size: number;
  createdTime: string;
  /** Drive дээр нээх холбоос — эзэн нь өөрөө нэвтэрсэн байдлаар татна */
  webViewLink: string;
};

/** Нөөцлөлтийн фолдер доторх файлууд — шинэ нь эхэндээ */
export async function listFiles(): Promise<DriveFile[]> {
  const config = await requireConfig();
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${config.folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, size, createdTime, webViewLink)",
      orderBy: "name desc",
      pageSize: "100",
      // Workspace-ийн Shared Drive дээр ч ажиллана
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });

    if (pageToken) params.set("pageToken", pageToken);

    const response = await call(`/files?${params}`);
    const data = (await response.json()) as {
      files?: (Omit<DriveFile, "size"> & { size?: string })[];
      nextPageToken?: string;
    };

    for (const file of data.files ?? []) {
      files.push({ ...file, size: Number(file.size ?? 0) });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}

/**
 * Файлыг ДИСКНЭЭС Drive рүү байршуулна.
 *
 * ЯАГААД ДИСКНЭЭС ВЭ: Drive-ийн resumable байршуулалт нь хэмжээ нь мэдэгдэхгүй
 * биеийг хэсэгчилж илгээхийг шаарддаг. Хуулбарыг эхлээд түр файлд бичээд
 * яг хэмжээг нь мэдсэнээр нэг PUT-аар, урсгалаар илгээж болно — санах ойд
 * бүтнээр барихгүй, нэмэлт логик ч хэрэггүй.
 */
export async function uploadFile(
  localPath: string,
  name: string
): Promise<DriveFile> {
  const config = await requireConfig();
  const token = await accessToken();
  const { size } = await stat(localPath);

  // 1-р алхам: сесс нээж, метадатаг өгнө
  const session = await fetch(
    `${UPLOAD}/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,size,createdTime,webViewLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "application/gzip",
        "X-Upload-Content-Length": String(size),
      },
      body: JSON.stringify({
        name,
        parents: [config.folderId],
        mimeType: "application/gzip",
      }),
    }
  );

  if (!session.ok) {
    const text = await session.text().catch(() => "");
    throw new Error(
      `Drive байршуулалт эхлэхгүй байна (${session.status}): ${text.slice(0, 200)}`
    );
  }

  const location = session.headers.get("location");
  if (!location) {
    throw new Error("Drive байршуулалтын хаяг ирсэнгүй.");
  }

  // 2-р алхам: биеийг урсгалаар илгээнэ
  const response = await fetch(location, {
    method: "PUT",
    headers: {
      "Content-Type": "application/gzip",
      "Content-Length": String(size),
    },
    body: Readable.toWeb(createReadStream(localPath)) as ReadableStream,
    // Node-ийн fetch нь урсгал биетэй үед үүнийг шаардана
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Drive байршуулалт амжилтгүй (${response.status}): ${text.slice(0, 200)}`
    );
  }

  const file = (await response.json()) as Omit<DriveFile, "size"> & {
    size?: string;
  };

  return { ...file, size: Number(file.size ?? size) };
}

export async function deleteFile(id: string): Promise<void> {
  await call(`/files/${id}?supportsAllDrives=true`, { method: "DELETE" });
}

/** Архивын агуулгыг татна — сэргээх скрипт ашиглана */
export async function downloadFile(id: string): Promise<Buffer> {
  const response = await call(`/files/${id}?alt=media&supportsAllDrives=true`);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Нөөцлөлтийн фолдерыг олох, байхгүй бол ҮҮСГЭНЭ.
 *
 * Хэрэглэгчээс фолдерын ID гуйхын оронд апп өөрөө үүсгэдэг болсон нь
 * тохиргоог хамгийн ихээр хялбарчилсан алхам: хүн Drive рүү орж, фолдер
 * үүсгээд, хаягийн мөрнөөс ID хуулах шаардлагагүй.
 *
 * `drive.file` эрхээр үүсгэсэн фолдер нь мөн энэ аппын "өөрийн" файл болох
 * тул дараа нь дотор нь бичих, жагсаах эрхтэй хэвээр байна.
 */
export async function ensureFolder(
  accessTokenValue: string,
  name: string
): Promise<{ id: string; name: string }> {
  const search = new URLSearchParams({
    q:
      `mimeType = 'application/vnd.google-apps.folder' and name = '${name.replace(/'/g, "\'")}' ` +
      "and trashed = false",
    fields: "files(id, name)",
    pageSize: "1",
  });

  const found = await fetch(`${API}/files?${search}`, {
    headers: { Authorization: `Bearer ${accessTokenValue}` },
  });

  if (found.ok) {
    const data = (await found.json()) as { files?: { id: string; name: string }[] };
    const existing = data.files?.[0];
    if (existing) return existing;
  }

  const created = await fetch(`${API}/files?fields=id,name`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessTokenValue}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!created.ok) {
    const text = await created.text().catch(() => "");
    throw new Error(`Фолдер үүсгэж чадсангүй: ${text.slice(0, 200)}`);
  }

  return (await created.json()) as { id: string; name: string };
}

/** Холбогдсон Google дансны и-мэйл — дэлгэцэд харуулна */
export async function accountEmail(accessTokenValue: string): Promise<string> {
  const response = await fetch(`${API}/about?fields=user(emailAddress)`, {
    headers: { Authorization: `Bearer ${accessTokenValue}` },
  });

  if (!response.ok) return "";

  const data = (await response.json()) as {
    user?: { emailAddress?: string };
  };

  return data.user?.emailAddress ?? "";
}
