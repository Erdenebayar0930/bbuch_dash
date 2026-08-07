import "server-only";

import { eq } from "drizzle-orm";

import { purchaseRequests, users } from "@/lib/db/schema";

/**
 * Худалдан авах хүсэлтийн жагсаалтын багана ба хүсэгчийн холболт.
 *
 * route.ts-ээс export хийвэл Next нь route файлын экспортыг шалгаад гомдох тул
 * хоёр route-д хуваалцах хэсгийг энд тусад нь байрлуулав.
 */
export const purchaseColumns = {
  id: purchaseRequests.id,
  name: purchaseRequests.name,
  quantity: purchaseRequests.quantity,
  unit: purchaseRequests.unit,
  estimatedPrice: purchaseRequests.estimatedPrice,
  priority: purchaseRequests.priority,
  status: purchaseRequests.status,
  note: purchaseRequests.note,
  requestedBy: purchaseRequests.requestedBy,
  requesterFirstName: users.firstName,
  requesterLastName: users.lastName,
  boughtAt: purchaseRequests.boughtAt,
  createdAt: purchaseRequests.createdAt,
} as const;

/** Хүсэлт гаргагчийн холболт — route-ууд хооронд зөрөхөөс сэргийлнэ */
export const requesterJoin = eq(purchaseRequests.requestedBy, users.uid);