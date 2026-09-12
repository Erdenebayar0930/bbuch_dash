"use client";

import { ShieldAlert } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import { aimags, labelOf } from "@/data/profileOptions";
import { isAdminRole } from "@/lib/permissions";

type AimagGuardProps = {
  /** profileOptions.aimags доторх түлхүүр */
  aimag: string;
  children: React.ReactNode;
};

/**
 * Тухайн аймгийн гишүүнд л хуудсыг нээнэ. Админ ба super бүгдийг харна.
 *
 * Цэс нуух нь хаягаар нь орохоос сэргийлэхгүй тул хуудас өөрөө шалгана.
 * Жинхэнэ хаалт нь серверийн `requireAimag` — энэ нь хэрэглэгчид ойлгомжтой
 * хариу өгөх давхарга: API 403 буцаасныг хоосон дэлгэц болгож харуулахгүй.
 *
 * `/unauthorized` руу хөөхгүй: тэр хуудас нь сессээ таслах (гарах) зориулалттай
 * бөгөөд эндхийн хэрэглэгч бол зүй ёсоор нэвтэрсэн, зүгээр л өөр аймгийнх.
 * Тайлбарыг байрандаа харуулж, хажуугийн цэсээр нь өөр хэсэг рүү явуулна.
 */
export default function AimagGuard({ aimag, children }: AimagGuardProps) {
  const { user } = useUser();

  const allowed =
    isAdminRole(user?.role) || (user?.aimags ?? []).includes(aimag);

  // Эхний рендер дээр user хараахан null байж болно — тэр үед эрхгүй гэж
  // шийдэж болохгүй, шалгаж байгааг л хэлнэ
  if (!user) {
    return (
      <p className="surface p-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
        Эрх шалгаж байна...
      </p>
    );
  }

  if (!allowed) {
    return (
      <div className="surface flex min-h-[240px] flex-col items-center justify-center gap-2 p-6 text-center">
        <ShieldAlert
          className="h-9 w-9 text-gray-300 dark:text-gray-600"
          strokeWidth={1.5}
        />
        <p className="text-base font-medium text-gray-800 dark:text-white/90">
          Энэ хэсэг таны аймагт хамаарахгүй
        </p>
        <p className="max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
          {labelOf(aimags, aimag)}-т харьяалагдах хүн эсвэл админ л үзэх
          боломжтой. Харьяаллаа өөрчлүүлэх бол админд хандана уу.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
