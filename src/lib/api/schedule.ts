import "server-only";

import { eq } from "drizzle-orm";

import { scheduleShifts, users } from "@/lib/db/schema";

/**
 * Ээлжийн жагсаалтын багана ба хариуцагчийн холболт.
 *
 * route.ts-ээс export хийвэл Next нь route файлын экспортыг шалгаад гомдох тул
 * хоёр route-д хуваалцах хэсгийг энд тусад нь байрлуулав.
 */
export const shiftColumns = {
  id: scheduleShifts.id,
  kind: scheduleShifts.kind,
  date: scheduleShifts.date,
  assignedTo: scheduleShifts.assignedTo,
  assigneeFirstName: users.firstName,
  assigneeLastName: users.lastName,
  assigneePhotoUrl: users.photoUrl,
  area: scheduleShifts.area,
  note: scheduleShifts.note,
  doneAt: scheduleShifts.doneAt,
  createdAt: scheduleShifts.createdAt,
} as const;

/** Хариуцагчийн холболтын нөхцөл — route-ууд хооронд зөрөхөөс сэргийлнэ */
export const assigneeJoin = eq(scheduleShifts.assignedTo, users.uid);