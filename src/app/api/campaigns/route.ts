import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  isAdminRole,
  requireActiveUser,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import { isCampaignBoard } from "@/data/campaignBoards";
import { readCampaign } from "@/lib/api/campaignInput";
import { canApprove, notifyApprovers, readApprovers } from "@/lib/api/campaignReview";
import { currentPeriod, rollOverMonthlyCampaigns } from "@/lib/api/campaignRollover";
import { db } from "@/lib/db";
import { donationCampaigns } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Хандивын аянууд — нээлттэй ба дууссан бүгд («Дууссан» табд гишүүд ч
 * харна). Өмнөх сарын сар бүрийн хандивыг эхлээд шинэ сар руу шилжүүлнэ.
 * Эрэмбэ: онцлох → админы эрэмбэ → шинэ нь.
 *
 * Гишүүд зөвхөн зөвшөөрсөн, өөрт нь хамаатай (бүгдэд эсвэл өөрийн аймагт
 * зарласан) хандивыг харна; админ ба зөвшөөрөгч бүгдийг.
 * `canApprove` нь дуудагч зөвшөөрөх товч харах эсэх.
 */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  // ?board=alms — Өглөг; бусад үед Хандив
  const boardParam = request.nextUrl.searchParams.get("board");
  const board = isCampaignBoard(boardParam) ? boardParam : "donation";

  try {
    await rollOverMonthlyCampaigns();

    const approvers = await readApprovers();
    const approver = canApprove(result.caller, approvers);
    const seesAll = approver || isAdminRole(result.caller.user?.role);
    const myAimags = result.caller.user?.aimags ?? [];

    // Хоосон `aimags` = бүгдэд; эс бөгөөс аль нэг аймаг нь таарвал
    const forMe = or(
      sql`jsonb_array_length(${donationCampaigns.aimags}) = 0`,
      ...myAimags.map(
        (aimag) => sql`${donationCampaigns.aimags} @> ${JSON.stringify([aimag])}::jsonb`
      )
    );

    const rows = await db
      .select()
      .from(donationCampaigns)
      .where(
        and(
          eq(donationCampaigns.board, board),
          seesAll ? undefined : eq(donationCampaigns.status, "approved"),
          seesAll ? undefined : forMe
        )
      )
      .orderBy(
        desc(donationCampaigns.featured),
        asc(donationCampaigns.position),
        desc(donationCampaigns.createdAt)
      );

    return NextResponse.json({ campaigns: rows, canApprove: approver });
  } catch (error) {
    return serverError(error, "Хандивын мэдээлэл уншихад алдаа гарлаа");
  }
}

/** Шинэ хандивын аян — зөвхөн админ. */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = readCampaign(body, false);
    if (!parsed.ok) return badRequest(parsed.error);

    const board = isCampaignBoard(body?.board) ? body.board : "donation";
    if (board === "alms" && !parsed.value.accountNumber) {
      return badRequest("Дансны дугаараа оруулна уу.");
    }
    // Өглөг нь үргэлж нэг удаагийнх
    const input = board === "alms" ? { ...parsed.value, kind: "once" as const } : parsed.value;
    const monthly = input.kind === "monthly";

    // Шинэ нь жагсаалтын төгсгөлд
    const [{ next }] = await db
      .select({ next: sql<number>`(coalesce(max(${donationCampaigns.position}), -1) + 1)::int` })
      .from(donationCampaigns);

    const id = crypto.randomUUID();
    const [created] = await db
      .insert(donationCampaigns)
      .values({
        position: next,
        ...input,
        id,
        title: input.title as string,
        // Сар бүрийнх одоогийн сараас эхэлж, өөрөө цувралынхаа эх болно
        period: monthly ? currentPeriod() : "",
        seriesId: monthly ? id : null,
        endsOn: monthly ? "" : (input.endsOn ?? ""),
        board,
        // Зөвшөөрөгч зөвшөөртөл гишүүдэд харагдахгүй
        status: "pending",
        createdBy: result.caller.uid,
      })
      .returning();

    await notifyApprovers(created, false);

    return NextResponse.json({ campaign: created });
  } catch (error) {
    return serverError(error, "Хандив нэмэхэд алдаа гарлаа");
  }
}
