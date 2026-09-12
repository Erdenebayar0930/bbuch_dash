import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Бүртгүүлэх | ББУЧ",
  description: "«ББУЧ» системд бүртгүүлэх.",
  // other metadata
};

export default function SignUp() {
  return <SignUpForm />;
}
