import { redirect } from "next/navigation";

/** «Тахилт дахь чуулган» нь бүлэг цэс — эхний дэд цэс рүү шилжинэ. */
export default function TahiltChurchPage() {
  redirect("/tahilt/church/gathering");
}
