import { redirect } from "next/navigation";

/** Тахилт нь бүлэг цэс — доод дэд цэс (Халамж) рүү шилжинэ. */
export default function GuardTahiltPage() {
  redirect("/aimag/guard/tahilt/welfare");
}
