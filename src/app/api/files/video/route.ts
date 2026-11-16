import { NextResponse } from "next/server";

import { badRequest, requireActiveUser } from "@/lib/api/auth";
import { resolveStored, statStored } from "@/lib/api/fileStore";
import { isSourceVideo, videoInfo } from "@/lib/api/videoTranscode";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Бичлэгийн тоглуулагчид — `?path=posts/<uid>/<uuid>.mov`. Аль чанар бэлэн,
 * зураг байгаа эсэхийг буцаана. Хөрвүүлээгүй бол дараалалд оруулна.
 */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const relative = request.nextUrl.searchParams.get("path") ?? "";
  if (!isSourceVideo(relative) || !resolveStored(relative)) return badRequest("Зам буруу байна.");
  if (!(await statStored(relative))) {
    return NextResponse.json({ error: "Бичлэг олдсонгүй." }, { status: 404 });
  }

  return NextResponse.json(videoInfo(relative));
}
