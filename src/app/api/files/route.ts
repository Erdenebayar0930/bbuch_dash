import { NextResponse } from "next/server";

import {
  badRequest,
  forbidden,
  getCallerOrResponse,
  requireActiveUser,
  requireAdmin,
  serverError,
  unauthorized,
} from "@/lib/api/auth";
import {
  SCOPES,
  UploadError,
  extensionFor,
  isSafeSegment,
  publicUrl,
  removeFolder,
  removeStored,
  saveUpload,
} from "@/lib/api/fileStore";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Эрхийн шалгалт — `Access` түвшингөөр. Дуудагчийн uid-ыг буцаана. */
async function authorize(request: NextRequest, access: "signed-in" | "active" | "admin") {
  if (access === "admin") return requireAdmin(request);
  if (access === "active") return requireActiveUser(request);

  const result = await getCallerOrResponse(request);
  if ("error" in result) return result;
  if (!result.caller) return { error: unauthorized() } as const;
  return { caller: result.caller } as const;
}

const failed = (error: unknown, fallback: string) =>
  error instanceof UploadError
    ? NextResponse.json({ error: error.message }, { status: error.status })
    : serverError(error, fallback);

/**
 * Файл байршуулна — биед нь файлын байтууд шууд (multipart биш), төрөл нь
 * `Content-Type` толгойд. `?scope=posts` (хавтас), `?key=<assetId>` (хэрэгтэй бол).
 *
 * Хариу: `{ url: "/uploads/...", path: "posts/<uid>/<uuid>.jpg" }`.
 */
export async function PUT(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const scopeName = params.get("scope") ?? "";
  const scope = SCOPES[scopeName];
  if (!scope) return badRequest("scope буруу байна.");

  const result = await authorize(request, scope.write);
  if ("error" in result) return result.error;
  const { caller } = result;

  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = extensionFor(type);
  const limit = ext ? scope.limit(type) : null;
  if (!ext || !limit) return badRequest("Энэ төрлийн файл оруулах боломжгүй.");

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > limit) {
    return NextResponse.json(
      { error: `Файлын хэмжээ ${Math.round(limit / (1024 * 1024))}MB-аас хэтэрч болохгүй.` },
      { status: 413 }
    );
  }
  if (!request.body) return badRequest("Файл хоосон байна.");

  let folder = scopeName;
  if (scope.folder === "uid") folder += `/${caller.uid}`;
  if (scope.folder === "key") {
    const key = params.get("key") ?? "";
    if (!isSafeSegment(key)) return badRequest("key буруу байна.");
    folder += `/${key}`;
  }

  try {
    const path = await saveUpload(request.body, folder, ext, limit, !!scope.replace);
    return NextResponse.json({ url: publicUrl(path), path });
  } catch (error) {
    return failed(error, "Файл хадгалахад алдаа гарлаа");
  }
}

/**
 * Файл устгана — `?path=posts/<uid>/<file>`. Эсвэл `?scope=profile_photos`
 * нь өөрийн профайлын зургийг (хавтсыг) бүхэлд нь устгана.
 * Байхгүй файл устгах нь алдаа биш.
 */
export async function DELETE(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const target = params.get("path") ?? "";
  const scopeName = target ? target.split("/")[0] : params.get("scope") ?? "";
  const scope = SCOPES[scopeName];
  if (!scope) return badRequest("Зам буруу байна.");

  const signed = await getCallerOrResponse(request);
  if ("error" in signed) return signed.error;
  if (!signed.caller) return unauthorized();
  const { caller } = signed;

  // Хэрэглэгчийн хавтастай бол хоёр дахь хэсэг нь эзний uid
  const owner = scope.folder === "uid" && (target ? target.split("/")[1] : caller.uid) === caller.uid;

  if (scope.remove === "owner" && !owner) return forbidden("Зөвхөн өөрийн файлаа устгана.");
  if (scope.remove === "admin" || (scope.remove === "owner-or-admin" && !owner)) {
    const admin = await requireAdmin(request);
    if ("error" in admin) return admin.error;
  }

  try {
    if (target) await removeStored(target);
    else if (scope.folder === "uid") await removeFolder(`${scopeName}/${caller.uid}`);
    else return badRequest("path шаардлагатай.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failed(error, "Файл устгахад алдаа гарлаа");
  }
}
