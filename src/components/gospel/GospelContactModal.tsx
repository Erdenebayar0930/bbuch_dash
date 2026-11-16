"use client";

import React, { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import { Modal } from "@/components/ui/modal";
import { MIN_BIRTH_YEAR, type GospelAimag } from "@/data/gospelOptions";
import { genders } from "@/data/profileOptions";
import {
  createGospelContact,
  updateGospelContact,
  type GospelArea,
  type GospelContact,
  type GospelContactInput,
} from "@/lib/gospel";
import { deleteGospelPhoto, uploadGospelPhoto } from "@/lib/storage";
import DateInput from "@/components/form/DateInput";

type GospelContactModalProps = {
  isOpen: boolean;
  /** null бол шинэ бүртгэл */
  contact: GospelContact | null;
  /** Бүртгэх үед оноох аймаг — тухайн цэсний аймаг */
  defaultAimag: GospelAimag;
  /** Бүртгэж болох аймгууд — энгийн гишүүнд зөвхөн өөрийнх нь */
  allowedAimags: GospelAimag[];
  /** Бүх таб ба задаргаа */
  areas: GospelArea[];
  /** Бүртгэх үед санал болгох ангилал — нээлттэй таб/задаргаа */
  defaultAreaId: string;
  onClose: () => void;
  onSaved: (contact: GospelContact) => void;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

/** Улаанбаатарын өнөөдөр, YYYY-MM-DD — огноо сонгох дээд хязгаар */
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar" }).format(
    new Date()
  );

const THIS_YEAR = new Date().getFullYear();

/** Маягтын төлөв — зураг нь тусдаа (файл сонгосон эсэхээс хамаарна) */
type FormState = Omit<GospelContactInput, "photoUrl" | "photoPath">;

const emptyForm = (aimag: GospelAimag, areaId: string): FormState => ({
  name: "",
  phone: "",
  gender: "",
  birthYear: 0,
  address: "",
  holySpiritBaptismDate: "",
  waterBaptismDate: "",
  note: "",
  aimag,
  areaId,
});

/** Сайн мэдээ хүлээн авсан хүнийг бүртгэх / засах цонх. */
export default function GospelContactModal({
  isOpen,
  contact,
  defaultAimag,
  allowedAimags,
  areas,
  defaultAreaId,
  onClose,
  onSaved,
}: GospelContactModalProps) {
  const { user } = useUser();

  const [form, setForm] = useState<FormState>(() =>
    emptyForm(defaultAimag, defaultAreaId)
  );
  /** Шинээр сонгосон зураг — хадгалах үед байршуулна */
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  /** Харуулж буй зураг: шинэ файлын түр URL, эсвэл хадгалагдсан зураг */
  const [photoPreview, setPhotoPreview] = useState("");
  /** Хадгалагдсан зургийг хасах гэж байгаа эсэх */
  const [photoRemoved, setPhotoRemoved] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Цонх нээгдэх бүрд маягтыг бөглөнө/цэвэрлэнэ
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setPhotoFile(null);
    setPhotoRemoved(false);
    setPhotoPreview(contact?.photoUrl ?? "");
    setForm(
      contact
        ? {
            name: contact.name,
            phone: contact.phone,
            gender: contact.gender,
            birthYear: contact.birthYear,
            address: contact.address,
            holySpiritBaptismDate: contact.holySpiritBaptismDate,
            waterBaptismDate: contact.waterBaptismDate,
            note: contact.note,
            aimag: contact.aimag,
            areaId: contact.areaId,
          }
        : emptyForm(
            allowedAimags.includes(defaultAimag) ? defaultAimag : allowedAimags[0],
            defaultAreaId
          )
    );
  }, [isOpen, contact, defaultAimag, allowedAimags, defaultAreaId]);

  // Шинэ файлын түр URL-ыг солих/хаах үед чөлөөлнө
  useEffect(() => {
    if (!photoFile) return;
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const pickPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Зөвхөн зураг оруулах боломжтой.");
      return;
    }
    setError(null);
    setPhotoFile(file);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview("");
    setPhotoRemoved(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Овог нэрээ оруулна уу.");
      return;
    }
    if (!form.areaId) {
      setError("Ангиллаа сонгоно уу.");
      return;
    }
    if (form.birthYear && (form.birthYear < MIN_BIRTH_YEAR || form.birthYear > THIS_YEAR)) {
      setError(`Төрсөн он ${MIN_BIRTH_YEAR}-${THIS_YEAR} хооронд байна.`);
      return;
    }
    if (!user?.uid) {
      setError("Нэвтэрсэн байх шаардлагатай.");
      return;
    }

    setSaving(true);
    setError(null);

    const oldPath = contact?.photoPath ?? "";
    let uploadedPath = "";

    try {
      // Зураг: шинэ файл → байршуулна; хассан → хоосон; бусад үед хуучнаараа
      let photo = { url: contact?.photoUrl ?? "", path: oldPath };
      if (photoFile) {
        photo = await uploadGospelPhoto(user.uid, photoFile);
        uploadedPath = photo.path;
      } else if (photoRemoved) {
        photo = { url: "", path: "" };
      }

      const input: GospelContactInput = {
        ...form,
        photoUrl: photo.url,
        photoPath: photo.path,
      };

      const saved = contact
        ? await updateGospelContact(contact.id, input)
        : await createGospelContact(input);

      // Хадгалагдсаны ДАРАА л хуучин файлыг цэвэрлэнэ
      if (oldPath && oldPath !== saved.photoPath) {
        void deleteGospelPhoto(oldPath);
      }

      onSaved(saved);
      onClose();
    } catch (err) {
      // Бүртгэл хадгалагдаагүй тул шинээр байршуулсан файл хог болно
      if (uploadedPath) void deleteGospelPhoto(uploadedPath);

      console.error("Сайн мэдээний бүртгэл хадгалахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  // Задаргаатай таб бол задаргааг нь сонгоно; задаргаагүй таб өөрөө сонголт
  const tabs = areas.filter((area) => !area.parentId);
  const childrenOf = (id: string) => areas.filter((area) => area.parentId === id);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg p-0">
      <form onSubmit={handleSubmit} className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {contact ? "Бүртгэл засах" : "Сайн мэдээ хүлээн авсан хүн бүртгэх"}
        </h3>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="gospel-name" className={labelClass}>
              Овог нэр <span className="text-error-500">*</span>
            </label>
            <input
              id="gospel-name"
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              maxLength={255}
              placeholder="Хүлээн авсан хүний овог нэр"
              className={fieldClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="gospel-area" className={labelClass}>
              Ангилал <span className="text-error-500">*</span>
            </label>
            <select
              id="gospel-area"
              value={form.areaId}
              onChange={(event) => set("areaId", event.target.value)}
              className={fieldClass}
            >
              <option value="" disabled>
                Сонгоно уу
              </option>
              {tabs.map((tab) => {
                const children = childrenOf(tab.id);
                return children.length === 0 ? (
                  <option key={tab.id} value={tab.id}>
                    {tab.name}
                  </option>
                ) : (
                  <optgroup key={tab.id} label={tab.name}>
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>

          <div className="sm:col-span-2">
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
            <label htmlFor="gospel-holy-spirit" className={labelClass}>
              Ариун сүнсний баптисм
            </label>
            <DateInput
              id="gospel-holy-spirit"
              value={form.holySpiritBaptismDate}
              max={today()}
              onChange={(event) => set("holySpiritBaptismDate", event.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="gospel-water" className={labelClass}>
              Усан баптисм
            </label>
            <DateInput
              id="gospel-water"
              value={form.waterBaptismDate}
              max={today()}
              onChange={(event) => set("waterBaptismDate", event.target.value)}
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

          <div>
            <label htmlFor="gospel-birth-year" className={labelClass}>
              Төрсөн он
            </label>
            <input
              id="gospel-birth-year"
              type="number"
              inputMode="numeric"
              min={MIN_BIRTH_YEAR}
              max={THIS_YEAR}
              value={form.birthYear || ""}
              onChange={(event) =>
                set("birthYear", Math.max(0, Math.trunc(Number(event.target.value) || 0)))
              }
              placeholder="Жишээ нь: 1995"
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

          <div className="sm:col-span-2">
            <p className={labelClass}>Зураг</p>

            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              onChange={pickPhoto}
              className="hidden"
            />

            {photoPreview ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element -- Storage/түр blob URL */}
                <img
                  src={photoPreview}
                  alt="Бүртгэлийн зураг"
                  className="h-32 w-32 rounded-lg border border-gray-200 object-cover dark:border-white/10"
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  aria-label="Зургийг хасах"
                  className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-gray-900/80 text-white transition-colors hover:bg-gray-900"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="mt-2 block text-theme-xs font-medium text-accent-600 hover:underline dark:text-accent-400"
                >
                  Өөр зураг сонгох
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex h-32 w-32 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 text-theme-xs text-gray-500 transition-colors hover:border-accent-400 hover:text-accent-600 dark:border-white/15 dark:text-gray-400"
              >
                <ImagePlus className="h-6 w-6" strokeWidth={1.6} />
                Зураг оруулах
              </button>
            )}
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
