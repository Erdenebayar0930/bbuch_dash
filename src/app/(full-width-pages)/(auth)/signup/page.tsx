import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Бүртгүүлэх | Бид туслая",
  description: "«Бид туслая» системд бүртгүүлэх.",
  // other metadata
};

export default function SignUp() {
  return <SignUpForm />;
}
