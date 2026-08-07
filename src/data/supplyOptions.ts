/**
 * Худалдан авах жагсаалтын тогтмолууд — сервер (шалгалт) ба клиент (UI)
 * хоёул эндээс уншина. Түлхүүр нь баазад бичигдэх утга тул шошгыг өөрчлөхөд
 * өгөгдөл хөндөгдөхгүй.
 *
 * Ач холбогдол нь taskOptions-ийн TaskPriority-г дахин ашиглана — нэг ойлголтод
 * хоёр жагсаалт барих шалтгаангүй.
 */

export type PurchaseStatus = "requested" | "approved" | "bought" | "rejected";

/** Жагсаалтын шүүлтүүр ба хүснэгтийн дараалал */
export const purchaseStatuses: PurchaseStatus[] = [
  "requested",
  "approved",
  "bought",
  "rejected",
];

export const purchaseStatusLabels: Record<PurchaseStatus, string> = {
  requested: "Хүсэлт",
  approved: "Зөвшөөрсөн",
  bought: "Худалдаж авсан",
  rejected: "Татгалзсан",
};

export const isPurchaseStatus = (value: unknown): value is PurchaseStatus =>
  typeof value === "string" &&
  purchaseStatuses.includes(value as PurchaseStatus);