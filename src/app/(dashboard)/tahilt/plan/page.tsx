import { redirect } from "next/navigation";

/**
 * Хуучин зам — Тахилтын «Төлөвлөгөө» нь «Тушаал» болж тусдаа хүснэгттэй
 * болсон. Хуучин холбоос, мэдэгдлүүд шинэ хуудас руу очно.
 */
export default function TahiltPlanPage() {
  redirect("/tahilt/commands");
}
