import { redirect } from "next/navigation";

/** Тахилт нь бүлэг цэс — доод дэд цэс (Халамж) рүү шилжинэ. */
export default function ServiceTahiltPage() {
  redirect("/aimag/service/tahilt/welfare");
}
