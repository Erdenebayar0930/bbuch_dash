import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Бид туслая — тавтай морилно уу",
  description: "Бид туслая — тавтай морилно уу. Зөвхөн дотоодын хэрэглэгчдэд зориулагдсан.",
};

export default function SignIn() {
  return <SignInForm />;
}
