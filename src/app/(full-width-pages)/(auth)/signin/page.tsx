import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ББУЧ-тавтай морилно уу",
  description: "ББУЧ-тавтай морилно уу. Зөвхөн дотоодын хэрэглэгчдэд зориулагдсан.",
};

export default function SignIn() {
  return <SignInForm />;
}
