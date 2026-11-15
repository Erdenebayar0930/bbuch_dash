"use client";

import React, { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import {
  gospelAimags,
  gospelResponseLabels,
  gospelResponses,
  type GospelAimag,
  type GospelResponse,
} from "@/data/gospelOptions";
import { aimags as aimagOptions, genders, labelOf } from "@/data/profileOptions";
import {
  createGospelContact,
  updateGospelContact,
  type GospelContact,
  type GospelContactInput,
} from "@/lib/gospel";

type GospelContactModalProps = {
  isOpen: boolean;
  /** null бол шинэ бүртгэл */
  contact: GospelContact | null;
  /** Бүртгэх үед санал болгох аймаг — тухайн цэсний аймаг */
  defaultAimag: GospelAimag;
  /** Сонгож болох аймгууд — энгийн гишүүнд зөвхөн өөрийнх нь */
  allowedAimags: GospelAimag[];
  onClose: () => void;
  onSaved: (contact: GospelContact) => void;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

/** Улаанбаатарын өнөөдөр, YYYY-MM-DD */
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar" }).format(
    new Date()
  );

const emptyForm = (aimag: GospelAimag): GospelContactInput => ({
  name: "",
  phone: "",
  gender: "",
  age: 0,
  address: "",
  sharedOn: today(),
  response: "interested",
  note: "",
  aimag,
});

/** Сайн мэдээ хүргэсэн хүнийг бүртгэх / засах цонх. */
export default function GospelContactModal({
  isOpen,
  contact,
  defaultAimag,
  allowedAimags,
  onClose,
  onSaved,
}: GospelContactModalProps) {
  const [form, setForm] = useState<GospelContactInput>(() => emptyForm(defaultAimag));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Цонх нээгдэх бүрд маягтыг бөглөнө/цэвэрлэнэ
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setForm(
      contact
        ? {
            name: contact.name,
            phone: contact.phone,
            gender: contact.gender,
            age: contact.age,
            address: contact.address,
            sharedOn: contact.sharedOn,
            response: contact.response,
            note: contact.note,
            aimag: contact.aimag,
          }
        : emptyForm(
            allowedAimags.includes(defaultAimag) ? defaultAimag : allowedAimags[0]
          )
    );
  }, [isOpen, contact, defaultAimag, allowedAimags]);

  const set = <K extends keyof GospelContactInput>(
    key: K,
    value: GospelContactInput[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Нэрээ оруулна уу.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const saved = contact
        ? await updateGospelContact(contact.id, form)
        : await createGospelContact(form);
      onSaved(saved);
      onClose();
    } catch (err) {
      console.error("Сайн мэдээний бүртгэл хадгалахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  // Засах үед хуучин аймаг нь сонголтод байхгүй байж болно — харуулсаар байна
  const aimagChoices = gospelAimags.filter(
    (aimag) => allowedAimags.includes(aimag) || aimag === form.aimag
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg p-0">
      <form onSubmit={handleSubmit} className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {contact ? "Бүртгэл засах" : "Сайн мэдээ хүргэсэн хүн бүртгэх"}
        </h3>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="gospel-name" className={labelClass}>
              Нэр <span className="text-error-500">*</span>
            </label>
            <input
              id="gospel-name"
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              maxLength={255}
              placeholder="Сайн мэдээ сонссон хүний нэр"
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="gospel-phone" className={labelClass}>
              Утас
            </label>
            <input
              id="gospel-phone"
              type="tel"
              value={form.phone}
              onChange={(event) => set("phone", event.target.value)}
              maxLength={32}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="gospel-shared-on" className={labelClass}>
              Хүргэсэн өдөр <span className="text-error-500">*</span>
            </label>
            <input
              id="gospel-shared-on"
              type="date"
              value={form.sharedOn}
              max={today()}
              onChange={(event) => set("sharedOn", event.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="gospel-gender" className={labelClass}>
              Хүйс
            </label>
            <select
              id="gospel-gender"
              value={form.gender}
              onChange={(event) => set("gender", event.target.value)}
              className={fieldClass}
            >
              <option value="">Сонгоогүй</option>
              {genders.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="gospel-age" className={labelClass}>
              Нас
            </label>
            <input
              id="gospel-age"
              type="number"
              min={0}
              max={120}
              value={form.age || ""}
              onChange={(event) =>
                set("age", Math.min(120, Math.max(0, Math.trunc(Number(event.target.value) || 0))))
              }
              placeholder="Мэдэхгүй бол хоосон"
              className={fieldClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="gospel-address" className={labelClass}>
              Хаяг
            </label>
            <input
              id="gospel-address"
              value={form.address}
              onChange={(event) => set("address", event.target.value)}
              maxLength={255}
              placeholder="Жишээ нь: БЗД, 26-р хороо"
              className={fieldClass}
            />
          </div>

          <div className="sm:col-span-2">
            <p className={labelClass}>Хариу</p>
            <div className="flex flex-wrap gap-2">
              {gospelResponses.map((value: GospelResponse) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set("response", value)}
                  aria-pressed={form.response === value}
                  className={`rounded-full border px-3.5 py-1.5 text-theme-sm font-medium transition-colors ${
                    form.response === value
                      ? "border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                  }`}
                >
                  {gospelResponseLabels[value]}
                </button>
              ))}
            </div>
          </div>

          {aimagChoices.length > 1 && (
            <div className="sm:col-span-2">
              <label htmlFor="gospel-aimag" className={labelClass}>
                Бүртгэсэн аймаг
              </label>
              <select
                id="gospel-aimag"
                value={form.aimag}
                onChange={(event) => set("aimag", event.target.value as GospelAimag)}
                className={fieldClass}
              >
                {aimagChoices.map((aimag) => (
                  <option key={aimag} value={aimag}>
                    {labelOf(aimagOptions, aimag)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="sm:col-span-2">
            <label htmlFor="gospel-note" className={labelClass}>
              Тэмдэглэл <span className="text-gray-400">(заавал биш)</span>
            </label>
            <textarea
              id="gospel-note"
              value={form.note}
              onChange={(event) => set("note", event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Дахин уулзах, залбирлын хүсэлт г.м."
              className={`${fieldClass} h-auto py-2.5`}
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            Болих
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Хадгалж байна..." : "Хадгалах"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
