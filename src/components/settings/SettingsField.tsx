"use client";

import React from "react";

type SettingsFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
};

/** Тохиргооны маягтын нэг талбар — гарчиг ба оролт. */
export default function SettingsField({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly = false,
  className = "",
}: SettingsFieldProps) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        className={`h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-theme-sm text-gray-800 shadow-theme-xs transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 ${
          readOnly ? "cursor-default text-gray-500 dark:text-gray-400" : ""
        }`}
      />
    </div>
  );
}
