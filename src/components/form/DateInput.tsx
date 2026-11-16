"use client";

import React, { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import { Mongolian } from "flatpickr/dist/l10n/mn";

type DateInputProps = {
  /** `YYYY-MM-DD`, хоосон бол сонгоогүй */
  value: string;
  /** `<input type="date">`-тэй ижил хэлбэр — `event.target.value` нь `YYYY-MM-DD` */
  onChange?: (event: { target: { value: string } }) => void;
  min?: string;
  max?: string;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
};

/**
 * Огноо сонгох талбар — үргэлж `2026-11-02` хэлбэрээр харуулж, бичиж болно.
 *
 * Хөтчийн `<input type="date">` нь огноог ХЭРЭГЛЭГЧИЙН ХӨТЧИЙН хэлээр
 * харуулдаг («11/02/2026», «02.11.2026» г.м.) бөгөөд үүнийг кодоор өөрчлөх
 * боломжгүй. Тиймээс flatpickr (монгол хэлтэй) ашиглана. `disableMobile` —
 * утсан дээр ч хөтчийн өөрийн сонгогч руу шилжихгүй (@see lib/dateFormat.ts).
 *
 * `<input type="date">`-ийн оронд шууд тавина: value/onChange нь адилхан.
 */
export default function DateInput({
  value,
  onChange,
  min,
  max,
  placeholder = "ОООО-СС-ӨӨ",
  className = "",
  ...rest
}: DateInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const picker = useRef<flatpickr.Instance | null>(null);
  // Сүүлийн onChange — flatpickr-ийг дахин үүсгэлгүй шинэчилнэ
  const handler = useRef(onChange);
  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!input.current) return;
    const instance = flatpickr(input.current, {
      locale: { ...Mongolian, firstDayOfWeek: 1 },
      dateFormat: "Y-m-d",
      allowInput: true,
      disableMobile: true,
      monthSelectorType: "static",
      onChange: (_dates, text) => handler.current?.({ target: { value: text } }),
      // Гараар бичээд гарахад (жишээ нь бүтэн устгахад) утгыг дамжуулна
      onClose: (_dates, text) => {
        if (input.current && input.current.value === "" && text === "") {
          handler.current?.({ target: { value: "" } });
        }
      },
    });
    picker.current = instance;
    return () => {
      instance.destroy();
      picker.current = null;
    };
  }, []);

  useEffect(() => {
    picker.current?.set("minDate", min || undefined);
    picker.current?.set("maxDate", max || undefined);
  }, [min, max]);

  useEffect(() => {
    const instance = picker.current;
    if (!instance) return;
    const shown = instance.selectedDates[0] ? instance.formatDate(instance.selectedDates[0], "Y-m-d") : "";
    if (shown !== value) instance.setDate(value || [], false, "Y-m-d");
  }, [value]);

  return (
    <input
      ref={input}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      defaultValue={value}
      placeholder={placeholder}
      className={className}
      {...rest}
    />
  );
}
