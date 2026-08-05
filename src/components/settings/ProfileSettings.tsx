"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { updateProfile } from "firebase/auth";
import Cropper, { type Area } from "react-easy-crop";

import { useUser } from "@/app/(auth)/UserProvider";
import {
  aimags,
  labelOf,
  loveLanguages,
  mbtiTypes,
} from "@/data/profileOptions";
import { auth } from "@/lib/firebase";
import {
  MAX_PROFILE_PHOTO_BYTES,
  deleteProfilePhoto,
  uploadProfilePhoto,
} from "@/lib/storage";
import {
  getChildren,
  getCurrentUser,
  saveChildren,
  updateCurrentUser,
  type Child,
} from "@/lib/users";
import { Modal } from "@/components/ui/modal";
import ChildrenEditor from "./ChildrenEditor";
import SettingsField from "./SettingsField";
import SettingsSelect from "./SettingsSelect";
import TemperamentPicker from "./TemperamentPicker";

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;


  /** Хувийн */
  mbti: string;
  loveLanguage: string;
  occupation: string;
  hasCar: boolean;
  carPlate: string;

  /** Гэр бүл */
  spouseName: string;
  spouseBirthDate: string;
};

const emptyForm: ProfileForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  mbti: "",
  loveLanguage: "",
  occupation: "",
  hasCar: false,
  carPlate: "",
  spouseName: "",
  spouseBirthDate: "",
};

type SaveState = "idle" | "saving" | "saved" | "error";

async function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // next/image-ийн `Image`-ээс ялгахын тулд DOM элементийг шууд үүсгэнэ.
    const image = document.createElement("img");
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.crossOrigin = "anonymous";
    image.src = url;
  });
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context is not available");
  }

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Зураг боловсруулахад алдаа гарлаа."));
      }
    }, "image/jpeg", 0.92);
  });
}

/** Админ оноодог утгуудыг зөвхөн харуулах шошго */
function ReadOnlyTags({
  label,
  values,
  empty,
}: {
  label: string;
  values: string[];
  empty: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </p>
      {values.length === 0 ? (
        <p className="flex h-11 items-center rounded-lg border border-dashed border-gray-200 px-4 text-theme-sm text-gray-400 dark:border-white/10 dark:text-gray-500">
          {empty}
        </p>
      ) : (
        <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-white/10">
          {values.map((value) => (
            <span
              key={value}
              className="rounded-full bg-accent-50 px-2.5 py-1 text-theme-xs font-medium text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
            >
              {value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [savedChildren, setSavedChildren] = useState<Child[]>([]);
  const [childList, setChildList] = useState<Child[]>([]);
  // Объект тул ProfileForm дотор биш тусад нь — харьцуулалт нь өөр
  const [savedTemperaments, setSavedTemperaments] = useState<
    Record<string, number>
  >({});
  const [temperamentScores, setTemperamentScores] = useState<
    Record<string, number>
  >({});
  // Зөвхөн харагдана — админ оноодог тул маягтын хэсэг биш
  const [callings, setCallings] = useState<string[]>([]);
  const [userAimags, setUserAimags] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(
    auth.currentUser?.photoURL ?? null
  );
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
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

      let loadedChildren: Child[] = [];
      let loadedTemperaments: Record<string, number> = {};
      let loadedCallings: string[] = [];
      let loadedAimags: string[] = [];

      if (auth.currentUser) {
        try {
          const [profile, kids] = await Promise.all([
            getCurrentUser(),
            getChildren().catch(() => [] as Child[]),
          ]);

          loadedChildren = kids;

          if (profile) {
            base.firstName = profile.first_name || base.firstName;
            base.lastName = profile.last_name || base.lastName;
            base.email = profile.email || base.email;
            base.phone = profile.phone;
            loadedCallings = profile.callings;
            loadedAimags = profile.aimags;
            base.mbti = profile.mbti;
            base.loveLanguage = profile.love_language;
            base.occupation = profile.occupation;
            loadedTemperaments = profile.temperaments ?? {};
            base.hasCar = profile.has_car;
            base.carPlate = profile.car_plate;
            base.spouseName = profile.spouse_name;
            base.spouseBirthDate = profile.spouse_birth_date;

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
        setSavedChildren(loadedChildren);
        setChildList(loadedChildren);
        setSavedTemperaments(loadedTemperaments);
        setTemperamentScores(loadedTemperaments);
        setCallings(loadedCallings);
        setUserAimags(loadedAimags);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    return () => {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  const update = useCallback(
    <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
      setSaveState("idle");
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateChildren = useCallback((next: Child[]) => {
    setSaveState("idle");
    setChildList(next);
  }, []);

  const updateTemperaments = useCallback((next: Record<string, number>) => {
    setSaveState("idle");
    setTemperamentScores(next);
  }, []);

  const formDirty = (Object.keys(form) as (keyof ProfileForm)[]).some(
    (key) => form[key] !== saved[key]
  );
  const childrenDirty =
    JSON.stringify(childList.map(({ name, birthDate, gender }) => [name, birthDate, gender])) !==
    JSON.stringify(savedChildren.map(({ name, birthDate, gender }) => [name, birthDate, gender]));
  // Түлхүүрийн дараалал хамаагүй тул эрэмбэлж харьцуулна
  const sortedEntries = (scores: Record<string, number>) =>
    JSON.stringify(Object.entries(scores).sort(([a], [b]) => a.localeCompare(b)));
  const temperamentsDirty =
    sortedEntries(temperamentScores) !== sortedEntries(savedTemperaments);

  const isDirty = formDirty || childrenDirty || temperamentsDirty;

  const handleSave = async () => {
    if (!auth.currentUser) return;

    setSaveState("saving");
    setSaveError(null);

    try {
      await updateCurrentUser({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        mbti: form.mbti,
        loveLanguage: form.loveLanguage,
        temperaments: temperamentScores,
        occupation: form.occupation,
        hasCar: form.hasCar,
        carPlate: form.hasCar ? form.carPlate : "",
        spouseName: form.spouseName,
        spouseBirthDate: form.spouseBirthDate,
      });

      const storedChildren = await saveChildren(childList);

      const nextForm = {
        ...form,
        carPlate: form.hasCar ? form.carPlate : "",
      };

      setSaved(nextForm);
      setForm(nextForm);
      setSavedChildren(storedChildren);
      setChildList(storedChildren);
      setSavedTemperaments(temperamentScores);
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
    setImageSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setIsCropOpen(true);
  };

  const onCropComplete = useCallback((_: Area, croppedArea: Area) => {
    setCroppedAreaPixels(croppedArea);
  }, []);

  const resetCropper = () => {
    setImageSrc(null);
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setIsCropOpen(false);
    setPhotoError(null);
  };

  const handleUploadSave = async () => {
    if (!auth.currentUser || !imageSrc || !croppedAreaPixels) return;

    setPhotoState("saving");
    setPhotoError(null);

    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const downloadUrl = await uploadProfilePhoto(auth.currentUser.uid, blob);

      // Firebase Auth дээр — бусад төхөөрөмж дээр шууд харагдана,
      // Postgres дээр — админы жагсаалт зэрэг сервер талын дүрслэлд хэрэгтэй.
      await updateProfile(auth.currentUser, { photoURL: downloadUrl });
      await updateCurrentUser({ photoUrl: downloadUrl });

      setProfilePhotoUrl(downloadUrl);
      if (user) {
        setUser({ ...user, photoURL: downloadUrl });
      }
      resetCropper();
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
            {callings[0] || form.occupation || user?.role || "—"}
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

      <Modal isOpen={isCropOpen} onClose={resetCropper} className="max-w-4xl p-4">
        <div className="grid gap-4">
          <div className="relative h-[420px] w-full overflow-hidden rounded-3xl bg-black">
            {imageSrc ? (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-white/70">
                Зураг ачаалж байна...
              </div>
            )}
          </div>

          <div className="grid gap-3 rounded-3xl bg-white p-4 shadow-theme-sm dark:bg-gray-900">
            <div className="space-y-2">
              <p className="text-theme-sm font-semibold text-gray-900 dark:text-white">
                Зургийг тайрах
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Зөвшөөрөгдсөн талбар: квадрат дүрс. Хайлтын хэсгийг тааруулна.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                Томруулалт
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 dark:bg-white/10"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={resetCropper}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
              >
                Буцах
              </button>
              <button
                type="button"
                onClick={handleUploadSave}
                disabled={photoState === "saving"}
                className="rounded-lg bg-accent-600 px-4 py-2 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {photoState === "saving" ? "Хадгалж байна..." : "Зургийг хадгалах"}
              </button>
            </div>
            {photoError && (
              <p className="text-theme-xs text-error-500">{photoError}</p>
            )}
          </div>
        </div>
      </Modal>

      {/* --- Ерөнхий --- */}
      <section className="mt-8">
        <SectionTitle title="Ерөнхий" description="Холбоо барих мэдээлэл" />

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <SettingsField
            id="first-name"
            label="Нэр"
            value={form.firstName}
            onChange={(value) => update("firstName", value)}
          />
          <SettingsField
            id="last-name"
            label="Овог"
            value={form.lastName}
            onChange={(value) => update("lastName", value)}
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
        </div>
      </section>

      {/* --- Чуулган (зөвхөн харагдана) --- */}
      <section className="mt-8">
        <SectionTitle
          title="Чуулган"
          description="Дуудлага, аймгийн харьяаллыг админ оноодог — та зөвхөн харна."
        />

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <ReadOnlyTags
            label="Дуудлага"
            values={callings}
            empty="Дуудлага оноогоогүй байна"
          />
          <ReadOnlyTags
            label="Аймаг"
            values={userAimags.map((value) => labelOf(aimags, value))}
            empty="Аймаг оноогоогүй байна"
          />
        </div>
      </section>

      {/* --- Хувийн --- */}
      <section className="mt-8">
        <SectionTitle
          title="Хувийн"
          description="Зан төлөв, ажил мэргэжил, тээврийн хэрэгсэл"
        />

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <SettingsSelect
            id="mbti"
            label="MBTI"
            value={form.mbti}
            options={mbtiTypes}
            onChange={(value) => update("mbti", value)}
          />
          <SettingsSelect
            id="love-language"
            label="Хайрын хэл"
            value={form.loveLanguage}
            options={loveLanguages}
            onChange={(value) => update("loveLanguage", value)}
          />
          <SettingsField
            id="occupation"
            label="Ажил мэргэжил"
            value={form.occupation}
            placeholder="Жишээ нь: Багш"
            onChange={(value) => update("occupation", value)}
          />

          <div className="sm:col-span-2">
            <p className="mb-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
              Темперамент
            </p>
            <TemperamentPicker
              value={temperamentScores}
              onChange={updateTemperaments}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="flex w-fit cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/[0.03]">
              <input
                type="checkbox"
                checked={form.hasCar}
                onChange={(event) => update("hasCar", event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500/30 dark:border-white/20 dark:bg-white/10"
              />
              <span className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                Машинтай
              </span>
            </label>
          </div>

          {form.hasCar && (
            <SettingsField
              id="car-plate"
              label="Машины дугаар"
              value={form.carPlate}
              placeholder="1234 УБА"
              onChange={(value) => update("carPlate", value)}
            />
          )}
        </div>
      </section>

      {/* --- Гэр бүл --- */}
      <section className="mt-8">
        <SectionTitle
          title="Гэр бүлийн бүртгэл"
          description="Эхнэр / нөхөр болон хүүхдүүдийн мэдээлэл"
        />

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <SettingsField
            id="spouse-name"
            label="Эхнэр / нөхрийн нэр"
            value={form.spouseName}
            placeholder="Нэр"
            onChange={(value) => update("spouseName", value)}
          />
          <SettingsField
            id="spouse-birth"
            label="Төрсөн огноо"
            type="date"
            value={form.spouseBirthDate}
            onChange={(value) => update("spouseBirthDate", value)}
          />
        </div>

        <div className="mt-5">
          <p className="mb-3 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            Хүүхдүүд
          </p>
          <ChildrenEditor value={childList} onChange={updateChildren} />
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
            setChildList(savedChildren);
            setTemperamentScores(savedTemperaments);
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
