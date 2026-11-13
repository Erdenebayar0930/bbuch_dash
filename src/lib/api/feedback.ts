import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { feedback, users } from "@/lib/db/schema";

/** Санал хүсэлтийн жагсаалтын багана — бичсэн хүний нэртэй хамт */
export const feedbackColumns = {
  id: feedback.id,
  authorUid: feedback.authorUid,
  authorFirstName: users.firstName,
  authorLastName: users.lastName,
  authorPhotoUrl: users.photoUrl,
  aimag: feedback.aimag,
  title: feedback.title,
  body: feedback.body,
  images: feedback.images,
  status: feedback.status,
  adminNote: feedback.adminNote,
  replies: feedback.replies,
  statusUpdatedAt: feedback.statusUpdatedAt,
  createdAt: feedback.createdAt,
} as const;

/** Нэг санал хүсэлтийг жагсаалтын хэлбэрээр уншина. */
export async function readFeedback(id: string) {
  const [row] = await db
    .select(feedbackColumns)
    .from(feedback)
    .leftJoin(users, eq(feedback.authorUid, users.uid))
    .where(eq(feedback.id, id))
    .limit(1);

  return row ?? null;
}
