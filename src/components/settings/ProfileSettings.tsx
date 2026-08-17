"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { updateProfile } from "firebase/auth";
import ImageCropModal from "@/components/common/ImageCropModal";

import { useUser } from "@/app/(auth)/UserProvider";
import { auth } from "@/lib/firebase";
import { asRole, roleLabels } from "@/lib/permissions";
import {
  MAX_PROFILE_PHOTO_BYTES,
  deleteProfilePhoto,
  uploadProfilePhoto,
} from "@/lib/storage";
import { getCurrentUser, updateCurrentUser } from "@/lib/users";
import SettingsField from "./SettingsField";

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

const emptyForm: ProfileForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
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
            loadedRole = profile.role || loadedRole;

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
        </div>
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
