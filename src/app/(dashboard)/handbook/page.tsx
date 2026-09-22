import { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Гарын авлага | ББУЧ",
  description: "Заавар, журмын баримт бичгүүд",
};

/** Гарын авлага цэс идэвхгүй болгосон — хүмүүст харагдахгүй, шууд URL-аар ч ороход 404. */
export default function HandbookPage() {
  notFound();
}
