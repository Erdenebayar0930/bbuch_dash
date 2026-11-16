"use client";

import React, { useState } from "react";

type PostAvatarProps = {
  name: string;
  photoUrl?: string | null;
  className?: string;
};

/** Нийтэлсэн хүний зураг — зураггүй эсвэл ачаалагдахгүй бол нэрийн эхний үсэг. */
export default function PostAvatar({ name, photoUrl, className = "h-10 w-10" }: PostAvatarProps) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (photoUrl && !failed) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element -- Firebase Storage URL */
      <img
        src={photoUrl}
        alt={name}
        onError={() => setFailed(true)}
        className={`${className} shrink-0 rounded-full object-cover ring-1 ring-gray-200 dark:ring-white/10`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-accent-100 text-theme-sm font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-300`}
    >
      {initial}
    </span>
  );
}
