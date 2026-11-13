/**
 * Санал хүсэлтийн явцын төлөвүүд — сервер ба клиент хоёул эндээс уншина.
 *
 * Үндсэн урсгал: Хүлээгдэж байгаа → Хүлээн авсан → Системд оруулсан →
 * Засварласан. "Нэмэлт тайлбар" ба "Татгалзсан" нь урсгалаас гарсан төлөв.
 */
export const feedbackStatuses = [
  "pending",
  "needs_info",
  "accepted",
  "in_system",
  "fixed",
  "rejected",
] as const;

export type FeedbackStatus = (typeof feedbackStatuses)[number];

export const feedbackStatusLabels: Record<FeedbackStatus, string> = {
  pending: "Хүлээгдэж байгаа",
  needs_info: "Нэмэлт тайлбар",
  accepted: "Хүлээн авсан",
  in_system: "Системд оруулсан",
  fixed: "Засварласан",
  rejected: "Татгалзсан",
};

/** Явцын шат — progress bar-д дарааллаар харуулна */
export const feedbackSteps: FeedbackStatus[] = [
  "pending",
  "accepted",
  "in_system",
  "fixed",
];

/** Админы тайлбар ЗААВАЛ шаардлагатай төлөвүүд */
export const feedbackNoteRequired: readonly FeedbackStatus[] = [
  "rejected",
  "needs_info",
];

export const isFeedbackStatus = (value: unknown): value is FeedbackStatus =>
  typeof value === "string" &&
  (feedbackStatuses as readonly string[]).includes(value);

/** Нэг санал хүсэлтэд оруулах зургийн дээд тоо */
export const MAX_FEEDBACK_IMAGES = 5;
