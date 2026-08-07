/**
 * Хайрцгийн эргэлтийн тогтмолууд — сервер (шалгалт) ба клиент (UI) хоёул
 * эндээс уншина. Түлхүүр нь баазад бичигдэх утга тул шошгыг өөрчлөхөд өгөгдөл
 * хөндөгдөхгүй.
 */

export type VisitStatus = "collected" | "empty" | "issue";

export const visitStatuses: VisitStatus[] = ["collected", "empty", "issue"];

export const visitStatusLabels: Record<VisitStatus, string> = {
  collected: "Хураасан",
  empty: "Хоосон байсан",
  issue: "Асуудалтай",
};

export const isVisitStatus = (value: unknown): value is VisitStatus =>
  typeof value === "string" && visitStatuses.includes(value as VisitStatus);