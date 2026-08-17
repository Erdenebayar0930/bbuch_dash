import { randomBytes, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import {
  badRequest,
  requireSuper,
  serverError,
  unauthorized,
} from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rateLimit";
import { runBackup } from "@/lib/backup/run";
import {
  BACKUP_RETENTION_KEY,
  BACKUP_TOKEN_KEY,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  getRetentionDays,
  getSetting,
  removeSetting,
  setSettings,
} from "@/lib/backup/settings";
import { isConfigured, listBackups } from "@/lib/backup/store";

import type { NextRequest } from "next/server";

// firebase-admin болон zlib нь Node.js runtime шаардана
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Backup нь удаан ажиллана — Passenger-ийн анхдагч таймаутад баригдахаас
 * сэргийлж дээд хугацааг ил зарлана.
 */
export const maxDuration = 300;

/**
 * Хугацааны нөлөөгүй харьцуулалт — токеныг тэмдэгт тэмдэгтээр нь таах
 * (timing) халдлагаас хамгаална.
 */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Дуудагч нь backup хийх эрхтэй эсэх.
 *
 * ХОЁР зам байна:
 *   • `x-backup-token` толгой — hPanel-ийн cron (curl) ашиглана. Cron нь
 *     нэвтэрч чадахгүй тул токенгүйгээр автоматжуулах боломжгүй.
 *   • Нэвтэрсэн СУПЕР АДМИН — гараар нэн даруй хуулбар авахад.
 *
 * Токен тохируулаагүй бол cron-ы зам БҮРЭН хаалттай байна: хоосон утгыг
 * зөвшөөрвөл эндпойнт нээлттэй үлдэнэ.
 */
async function authorize(request: NextRequest) {
  const provided = request.headers.get("x-backup-token") ?? "";

  if (provided) {
    /**
     * Токеныг БААЗААС уншина; env нь нөөц зам.
     *
     * Баазад байгаа нь hPanel руу орж хувьсагч нэмээд дахин деплой хийх
     * алхмыг арилгана — токеныг дэлгэцээс шууд үүсгэнэ.
     */
    const expected =
      (await getSetting(BACKUP_TOKEN_KEY)) ?? process.env.BACKUP_TOKEN ?? "";

    if (expected && tokenMatches(provided, expected)) {
      return { ok: true } as const;
    }
  }

  // Токен таарсангүй — нэвтэрсэн супер админ эсэхийг шалгана
  const result = await requireSuper(request);
  if ("error" in result) return { ok: false, error: result.error } as const;

  return { ok: true } as const;
}

/**
 * Архивуудын жагсаалт ба тохиргооны төлөв.
 *
 * Тохиргоог хамт буцаах нь санаатай: нөөцлөлт ажиллахгүй байгаа хоёр хамгийн
 * түгээмэл шалтгаан нь `BACKUP_TOKEN` эсвэл Google Drive тохируулаагүй байх
 * бөгөөд тэдгээрийг лог уншилгүй харах ганц газар нь энэ дэлгэц болно.
 *
 * Татах холбоос энд байхгүй: архив нь эзний Drive дотор байгаа тул жагсаалт
 * дахь `link`-ээр шууд нээнэ — файлыг сервер дамжуулах шаардлагагүй.
 */
export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.error ?? unauthorized();

  const driveReady = await isConfigured();

  try {
    const backups = driveReady ? await listBackups() : [];

    return NextResponse.json({
      backups,
      settings: {
        retentionDays: await getRetentionDays(),
        retentionRange: { min: MIN_RETENTION_DAYS, max: MAX_RETENTION_DAYS },
        tokenConfigured: Boolean(
          (await getSetting(BACKUP_TOKEN_KEY)) ?? process.env.BACKUP_TOKEN
        ),
        /**
         * Cron-д хуулж тавих бүтэн команд. Токеныг агуулна — энэ хариу нь
         * зөвхөн супер админд очдог тул зөвшөөрөгдөнө.
         */
        cronCommand: await cronCommand(request),
        driveConfigured: driveReady,
        lastBackupAt: backups[0]?.createdAt ?? null,
      },
    });
  } catch (error) {
    return serverError(error, "Архивуудыг уншихад алдаа гарлаа");
  }
}

/**
 * Шинэ backup үүсгэнэ.
 *
 * Cron-оос дуудах жишээ (hPanel → Advanced → Cron Jobs, өдөрт 1 удаа):
 *   curl -fsS -X POST -H "x-backup-token: <BACKUP_TOKEN>" \
 *     https://dash.bbuchmongol.com/api/backup
 */
export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.error ?? unauthorized();

  /**
   * Backup нь сан ба Storage хоёуланд нь ачаалал өгнө. Хязгааргүй бол
   * токен алдагдсан үед (эсвэл cron давхарлаж тохируулсан үед) сангаа
   * өөрсдөө унагаах суваг болно.
   */
  const limited = rateLimit(request, {
    name: "backup",
    limit: 4,
    windowMs: 3_600_000,
  });
  if (limited) return limited;

  try {
    const result = await runBackup();

    console.log("[backup] амжилттай", {
      name: result.name,
      rows: result.totalRows,
      ms: result.durationMs,
      pruned: result.pruned.length,
    });

    return NextResponse.json(result);
  } catch (error) {
    // Backup чимээгүй бүтэлгүйтэх нь хамгийн аюултай — лог руу тод бичнэ
    console.error("[backup] БҮТЭЛГҮЙТЛЭЭ:", error);
    return serverError(error, "Backup үүсгэхэд алдаа гарлаа");
  }
}


/** hPanel-ийн cron-д хуулж тавих бүтэн команд */
async function cronCommand(request: NextRequest): Promise<string | null> {
  const token = (await getSetting(BACKUP_TOKEN_KEY)) ?? process.env.BACKUP_TOKEN;
  if (!token) return null;

  const url = new URL("/api/backup", request.nextUrl.origin).toString();
  return `curl -fsS -X POST -H "x-backup-token: ${token}" ${url}`;
}

/**
 * Cron токен үүсгэх / устгах.
 *
 * Шинээр үүсгэхэд ХУУЧИН нь тэр дороо хүчингүй болно — алдагдсан токеныг
 * сольж болно гэсэн үг.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireSuper(request);
  if ("error" in auth) return auth.error;

  try {
    await setSettings({ [BACKUP_TOKEN_KEY]: randomBytes(32).toString("hex") });
    return NextResponse.json({ cronCommand: await cronCommand(request) });
  } catch (error) {
    return serverError(error, "Токен үүсгэхэд алдаа гарлаа");
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireSuper(request);
  if ("error" in auth) return auth.error;

  try {
    await removeSetting(BACKUP_TOKEN_KEY);
    return NextResponse.json({ cronCommand: null });
  } catch (error) {
    return serverError(error, "Токен устгахад алдаа гарлаа");
  }
}


/** Хадгалах хугацааг өөрчилнө. */
export async function PATCH(request: NextRequest) {
  const auth = await requireSuper(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const days = Number(body.retentionDays);

    if (!Number.isFinite(days) || days < MIN_RETENTION_DAYS || days > MAX_RETENTION_DAYS) {
      return badRequest(
        `Хадгалах хугацаа ${MIN_RETENTION_DAYS}-${MAX_RETENTION_DAYS} хоногийн хооронд байна.`
      );
    }

    await setSettings({ [BACKUP_RETENTION_KEY]: String(Math.round(days)) });

    return NextResponse.json({ retentionDays: await getRetentionDays() });
  } catch (error) {
    return serverError(error, "Хугацааг хадгалахад алдаа гарлаа");
  }
}
