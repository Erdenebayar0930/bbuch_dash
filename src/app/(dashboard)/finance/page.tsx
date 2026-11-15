import { redirect } from "next/navigation";

/** «Санхүү» нь бүлэг цэс — эхний дэд цэс (1/10 ба өргөл) рүү шилжинэ. */
export default function FinancePage() {
  redirect("/finance/allocation");
}
