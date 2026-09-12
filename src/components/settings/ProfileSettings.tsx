"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { updateProfile } from "firebase/auth";
import ImageCropModal from "@/components/common/ImageCropModal";
import Checkbox from "@/components/form/input/Checkbox";
import Badge from "@/components/ui/badge/Badge";

import { useUser } from "@/app/(auth)/UserProvider";
import {
  aimags as aimagOptions,
  genders,
  labelOf,
  loveLanguages as loveLanguageOptions,
  mbtiTypes,
  temperaments as temperamentOptions,
} from "@/data/profileOptions";
import { auth } from "@/lib/firebase";
import { asRole, roleLabels } from "@/lib/permissions";
import {
  MAX_PROFILE_PHOTO_BYTES,
  deleteProfilePhoto,
  uploadProfilePhoto,
} from "@/lib/storage";
import { getCurrentUser, updateCurrentUser } from "@/lib/users";
import ChildrenEditor from "./ChildrenEditor";
import ScoredMultiSelect from "./ScoredMultiSelect";
import SettingsField from "./SettingsField";
import SettingsSelect from "./SettingsSelect";

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: string;
  ethnicity: string;
  birthplace: string;
  holySpiritBaptismDate: string;
  waterBaptismDate: string;
  mbti: string;
  loveLanguages: Record<string, number>;
  temperaments: Record<string, number>;
  occupation: string;
  hasCar: boolean;
  carPlate: string;
  spouseName: string;
  spouseBirthDate: string;
};

const emptyForm: ProfileForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  birthDate: "",
  gender: "",
  ethnicity: "",
  birthplace: "",
  holySpiritBaptismDate: "",
  waterBaptismDate: "",
  mbti: "",
  loveLanguages: {},
  temperaments: {},
  occupation: "",
  hasCar: false,
  carPlate: "",
  spouseName: "",
  spouseBirthDate: "",
};

type SaveState = "idle" | "saving" | "saved" | "error";

/** Маягтын хэсгийн гарчиг */
function SectionTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4 border-b border-gray-100 pb-3 dark:border-white/10">
      <h3 className="text-theme-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
    </div>
  );
}

export default function ProfileSettings() {
  const { user, setUser } = useUser();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [saved, setSaved] = useState<ProfileForm>(emptyForm);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  // Зөвхөн харагдана — эрхийг админ оноодог тул маягтын хэсэг биш
  const [role, setRole] = useState<string>(user?.role ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(
    auth.currentUser?.photoURL ?? null
  );
  /** Тайрахаар хүлээж буй файл — null бол цонх хаалттай */
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [photoState, setPhotoState] = useState<SaveState>("idle");
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Зөвхөн харагдана — админ /users хуудаснаас оноодог
  const [churchInfo, setChurchInfo] = useState<{
    callings: string[];
    aimags: string[];
  }>({ callings: [], aimags: [] });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const base: ProfileForm = {
        ...emptyForm,
        firstName: user?.first_name ?? "",
        lastName: user?.last_name ?? "",
        email: user?.email ?? "",
      };

      let loadedRole = user?.role ?? "";

      if (auth.currentUser) {
        try {
          const profile = await getCurrentUser();

          if (profile) {
            base.firstName = profile.first_name || base.firstName;
            base.lastName = profile.last_name || base.lastName;
            base.email = profile.email || base.email;
            base.phone = profile.phone;
            base.birthDate = profile.birth_date;
            base.gender = profile.gender;
            base.ethnicity = profile.ethnicity;
            base.birthplace = profile.birthplace;
            base.holySpiritBaptismDate = profile.holy_spirit_baptism_date;
            base.waterBaptismDate = profile.water_baptism_date;
            base.mbti = profile.mbti;
            base.loveLanguages = profile.love_languages;
            base.temperaments = profile.temperaments;
            base.occupation = profile.occupation;
            base.hasCar = profile.has_car;
            base.carPlate = profile.car_plate;
            base.spouseName = profile.spouse_name;
            base.spouseBirthDate = profile.spouse_birth_date;
            loadedRole = profile.role || loadedRole;

            if (!cancelled) {
              setChurchInfo({
                callings: profile.callings,
                aimags: profile.aimags,
              });
            }

            if (!cancelled && profile.photo_url) {
              setProfilePhotoUrl(profile.photo_url);
            }
          }
        } catch (error) {
          console.error("Профайл ачаалж чадсангүй:", error);
        }
      }

      if (!cancelled) {
        setSaved(base);
        setForm(base);
        setRole(loadedRole);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const update = useCallback(
    <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
      setSaveState("idle");
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const isDirty = (Object.keys(form) as (keyof ProfileForm)[]).some(
    (key) => form[key] !== saved[key]
  );

  const handleSave = async () => {
    if (!auth.currentUser) return;

    setSaveState("saving");
    setSaveError(null);

    try {
      await updateCurrentUser({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        birthDate: form.birthDate,
        gender: form.gender,
        ethnicity: form.ethnicity,
        birthplace: form.birthplace,
        holySpiritBaptismDate: form.holySpiritBaptismDate,
        waterBaptismDate: form.waterBaptismDate,
        mbti: form.mbti,
        loveLanguages: form.loveLanguages,
        temperaments: form.temperaments,
        occupation: form.occupation,
        hasCar: form.hasCar,
        carPlate: form.carPlate,
        spouseName: form.spouseName,
        spouseBirthDate: form.spouseBirthDate,
      });

      setSaved(form);
      setSaveState("saved");

      if (user) {
        setUser({
          ...user,
          first_name: form.firstName,
          last_name: form.lastName,
        });
      }
    } catch (error) {
      console.error("Профайл хадгалж чадсангүй:", error);
      setSaveState("error");
      setSaveError(
        error instanceof Error ? error.message : "Хадгалахад алдаа гарлаа."
      );
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !file.type.startsWith("image/")) {
      setPhotoState("error");
      setPhotoError("Зураг файл сонгоно уу.");
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      setPhotoState("error");
      setPhotoError("Зургийн хэмжээ 5MB-аас хэтэрч болохгүй.");
      return;
    }

    setPhotoState("idle");
    setPhotoError(null);
    setPendingPhoto(file);
  };

  /** Тайрсан зургийг Storage-д тавьж, Auth ба Postgres-д хоёуланд нь бичнэ */
  const handleCropDone = async (blob: Blob) => {
    setPendingPhoto(null);

    if (!auth.currentUser) return;

    setPhotoState("saving");
    setPhotoError(null);

    try {
      const downloadUrl = await uploadProfilePhoto(auth.currentUser.uid, blob);

      // Firebase Auth дээр — бусад төхөөрөмж дээр шууд харагдана,
      // Postgres дээр — админы жагсаалт зэрэг сервер талын дүрслэлд хэрэгтэй.
      await updateProfile(auth.currentUser, { photoURL: downloadUrl });
      await updateCurrentUser({ photoUrl: downloadUrl });

      setProfilePhotoUrl(downloadUrl);
      if (user) {
        setUser({ ...user, photoURL: downloadUrl });
      }
      setPhotoState("saved");
    } catch (error) {
      console.error("Профайл зураг хадгалах үед алдаа гарлаа:", error);
      setPhotoState("error");
      setPhotoError(
        error instanceof Error
          ? error.message
          : "Профайлын зураг шинэчлэхэд алдаа гарлаа."
      );
    }
  };

  const handleRemovePhoto = async () => {
    if (!auth.currentUser) return;

    setPhotoState("saving");
    setPhotoError(null);

    try {
      await deleteProfilePhoto(auth.currentUser.uid);
      await updateProfile(auth.currentUser, { photoURL: "" });
      await updateCurrentUser({ photoUrl: "" });

      setProfilePhotoUrl(null);
      if (user) {
        setUser({ ...user, photoURL: "" });
      }
      setPhotoState("idle");
    } catch (error) {
      console.error("Профайл зураг устгах үед алдаа гарлаа:", error);
      setPhotoState("error");
      setPhotoError("Зураг устгахад алдаа гарлаа.");
    }
  };

  const fullName = [form.firstName, form.lastName].filter(Boolean).join(" ");
  const initial = form.firstName?.[0] ?? form.lastName?.[0] ?? "?";
  const currentPhoto =
    profilePhotoUrl ?? user?.photoURL ?? auth.currentUser?.photoURL;
  const roleLabel = role ? roleLabels[asRole(role)] : "—";

  return (
    <div>
      {/* Хэрэглэгчийн товч мэдээлэл */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-accent-50/70 p-5 dark:bg-white/[0.04]">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-navy-900 text-2xl font-semibold uppercase text-white">
          {currentPhoto ? (
            <Image
              src={currentPhoto}
              alt={fullName || "Profile photo"}
              width={64}
              height={64}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              {initial}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-gray-900 dark:text-white">
            {fullName || "Нэр оруулаагүй"}
          </p>
          <p className="mt-0.5 truncate text-theme-xs text-gray-500 dark:text-gray-400">
            {roleLabel}
          </p>
          {form.email && (
            <a
              href={`mailto:${form.email}`}
              className="mt-1 block truncate text-theme-sm text-accent-600 hover:underline dark:text-accent-400"
            >
              {form.email}
            </a>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openFileDialog}
              disabled={photoState === "saving"}
              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-theme-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
            >
              Зураг солих
            </button>
            {currentPhoto && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={photoState === "saving"}
                className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-theme-sm font-medium text-error-500 transition-colors hover:bg-error-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03]"
              >
                Устгах
              </button>
            )}
          </div>
          {photoState === "saved" && (
            <span className="text-theme-xs text-success-600 dark:text-success-400">
              Шинэчлэгдсэн
            </span>
          )}
          {photoState === "error" && (
            <span className="text-theme-xs text-error-500">{photoError}</span>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />

      {/* Профайл зураг — квадрат, 512px хүртэл багасгана */}
      <ImageCropModal
        file={pendingPhoto}
        aspect={1}
        maxDimension={512}
        onCancel={() => setPendingPhoto(null)}
        onDone={handleCropDone}
      />

      {/* --- Ерөнхий --- */}
      <section className="mt-8">
        <SectionTitle title="Ерөнхий" description="Холбоо барих мэдээлэл" />

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <SettingsField
            id="last-name"
            label="Овог"
            value={form.lastName}
            onChange={(value) => update("lastName", value)}
          />
          <SettingsField
            id="first-name"
            label="Нэр"
            value={form.firstName}
            onChange={(value) => update("firstName", value)}
          />
          <SettingsField
            id="email"
            label="Имэйл"
            type="email"
            value={form.email}
            readOnly
          />
          <SettingsField
            id="phone"
            label="Утас"
            value={form.phone}
            placeholder="+976 ...."
            onChange={(value) => update("phone", value)}
          />
          {/* Эрхийг админ оноодог — энд зөвхөн харагдана */}
          <SettingsField id="role" label="Эрх" value={roleLabel} readOnly />
          <SettingsField
            id="birth-date"
            label="Төрсөн огноо"
            type="date"
            value={form.birthDate}
            onChange={(value) => update("birthDate", value)}
          />
          <SettingsSelect
            id="gender"
            label="Хүйс"
            value={form.gender}
            options={genders}
            onChange={(value) => update("gender", value)}
          />
          <SettingsField
            id="ethnicity"
            label="Яс үндэс"
            value={form.ethnicity}
            onChange={(value) => update("ethnicity", value)}
          />
          <SettingsField
            id="birthplace"
            label="Төрсөн нутаг"
            value={form.birthplace}
            onChange={(value) => update("birthplace", value)}
          />
          <SettingsField
            id="occupation"
            label="Мэргэжил"
            value={form.occupation}
            onChange={(value) => update("occupation", value)}
          />
        </div>
      </section>

      {/* --- Чуулган --- */}
      <section className="mt-8">
        <SectionTitle
          title="Чуулган"
          description="Дуудлага, аймгийг зөвхөн админ оноодог"
        />

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <SettingsField
            id="holy-spirit-baptism"
            label="Ариунсүнсний баптисм"
            type="date"
            value={form.holySpiritBaptismDate}
            onChange={(value) => update("holySpiritBaptismDate", value)}
          />
          <SettingsField
            id="water-baptism"
            label="Усан баптисм"
            type="date"
            value={form.waterBaptismDate}
            onChange={(value) => update("waterBaptismDate", value)}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
              Дуудлага
            </p>
            <div className="flex flex-wrap gap-1.5">
              {churchInfo.callings.length === 0 ? (
                <span className="text-theme-xs text-gray-400">
                  Админ оноогоогүй байна.
                </span>
              ) : (
                churchInfo.callings.map((calling) => (
                  <Badge key={calling} size="sm">
                    {calling}
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
              Аймаг
            </p>
            <div className="flex flex-wrap gap-1.5">
              {churchInfo.aimags.length === 0 ? (
                <span className="text-theme-xs text-gray-400">
                  Админ оноогоогүй байна.
                </span>
              ) : (
                churchInfo.aimags.map((aimag) => (
                  <Badge key={aimag} size="sm" color="success">
                    {labelOf(aimagOptions, aimag)}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* --- Био --- */}
      <section className="mt-8">
        <SectionTitle title="Био" />

        <SettingsSelect
          id="mbti"
          label="MBTI"
          value={form.mbti}
          options={mbtiTypes}
          onChange={(value) => update("mbti", value)}
          className="max-w-xs"
        />

        <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
          <ScoredMultiSelect
            label="Темперамент"
            description="Хэдэн ч төрөл зэрэг сонгож, оноогоо өгч болно."
            options={temperamentOptions}
            value={form.temperaments}
            onChange={(value) => update("temperaments", value)}
          />
          <ScoredMultiSelect
            label="Хайрын хэл"
            description="Хэдэн ч хэл зэрэг сонгож, оноогоо өгч болно."
            options={loveLanguageOptions}
            value={form.loveLanguages}
            onChange={(value) => update("loveLanguages", value)}
          />
        </div>
      </section>

      {/* --- Гэр бүл --- */}
      <section className="mt-8">
        <SectionTitle title="Гэр бүл" />

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <SettingsField
            id="spouse-name"
            label="Эхнэр / нөхрийн нэр"
            value={form.spouseName}
            onChange={(value) => update("spouseName", value)}
          />
          <SettingsField
            id="spouse-birth-date"
            label="Эхнэр / нөхрийн төрсөн огноо"
            type="date"
            value={form.spouseBirthDate}
            onChange={(value) => update("spouseBirthDate", value)}
          />
        </div>

        <div className="mt-6 border-t border-gray-100 pt-5 dark:border-white/10">
          <ChildrenEditor />
        </div>
      </section>

      {/* --- Тээвэр --- */}
      <section className="mt-8">
        <SectionTitle title="Тээвэр" />

        <Checkbox
          id="has-car"
          label="Машинтай"
          checked={form.hasCar}
          onChange={(checked) => update("hasCar", checked)}
        />

        {form.hasCar && (
          <SettingsField
            id="car-plate"
            label="Улсын дугаар"
            value={form.carPlate}
            onChange={(value) => update("carPlate", value)}
            className="mt-4 max-w-xs"
          />
        )}
      </section>

      {/* Үйлдэл */}
      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5 dark:border-white/10">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saveState === "saving"}
          className="rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveState === "saving" ? "Хадгалж байна..." : "Хадгалах"}
        </button>

        <button
          type="button"
          onClick={() => {
            setForm(saved);
            setSaveState("idle");
            setSaveError(null);
          }}
          disabled={!isDirty}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
        >
          Цуцлах
        </button>

        {saveState === "saved" && (
          <span className="text-theme-sm text-success-600 dark:text-success-400">
            Хадгаллаа
          </span>
        )}
        {saveState === "error" && (
          <span className="text-theme-sm text-error-500">
            {saveError ?? "Хадгалахад алдаа гарлаа"}
          </span>
        )}
      </div>
    </div>
  );
}
