"use client";

import React, { useEffect, useMemo, useState } from "react";
import { UserPlus, X } from "lucide-react";

import { MAX_POST_TAG_NAME, MAX_POST_TAGS, type PostTag } from "@/data/postOptions";
import { apiFetch } from "@/lib/apiClient";

type Member = { uid: string; name: string };

/** Гишүүдийн жагсаалтыг хуудас дахин ачаалах хүртэл нэг л удаа уншина */
let membersCache: Promise<Member[]> | null = null;

const loadMembers = () => {
  membersCache ??= apiFetch<{ users: Member[] }>("/api/users/names")
    .then((data) => data.users ?? [])
    .catch((error) => {
      membersCache = null;
      throw error;
    });
  return membersCache;
};

const tagKey = (tag: PostTag) => tag.uid ?? `name:${tag.name.toLowerCase()}`;

type PostTagPickerProps = {
  value: PostTag[];
  onChange: (tags: PostTag[]) => void;
  disabled?: boolean;
};

/**
 * Нийтлэлд нэр цохох — гишүүдээс хайж сонгоно, системд бүртгэлгүй хүний
 * нэрийг бичээд Enter дарж нэмнэ.
 */
export default function PostTagPicker({ value, onChange, disabled }: PostTagPickerProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadMembers()
      .then(setMembers)
      .catch((err) => console.error("Гишүүдийн нэр уншихад алдаа гарлаа:", err));
  }, []);

  const taken = useMemo(() => new Set(value.map(tagKey)), [value]);
  const full = value.length >= MAX_POST_TAGS;
  const trimmed = query.replace(/\s+/g, " ").trim();

  const matches = useMemo(() => {
    const needle = trimmed.toLowerCase();
    return members
      .filter((member) => !taken.has(member.uid))
      .filter((member) => !needle || member.name.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [members, taken, trimmed]);

  const add = (tag: PostTag) => {
    if (full || taken.has(tagKey(tag))) return;
    onChange([...value, tag]);
    setQuery("");
  };

  const addTyped = () => {
    if (!trimmed) return;
    // Бичсэн нэр гишүүний нэртэй яг таарвал гишүүнээр нь холбоно
    const exact = members.find((member) => member.name.toLowerCase() === trimmed.toLowerCase());
    add(exact ? { uid: exact.uid, name: exact.name } : { uid: null, name: trimmed.slice(0, MAX_POST_TAG_NAME) });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-theme-sm text-gray-600 dark:text-gray-300">
        <UserPlus className="h-5 w-5 text-accent-600 dark:text-accent-400" strokeWidth={1.8} />
        Нэр цохох
        {value.length > 0 && (
          <span className="text-theme-xs text-gray-400">
            {value.length}/{MAX_POST_TAGS}
          </span>
        )}
      </div>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li
              key={tagKey(tag)}
              className={`inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-theme-sm ${
                tag.uid
                  ? "bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300"
                  : "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300"
              }`}
            >
              {tag.name}
              <button
                type="button"
                onClick={() => onChange(value.filter((other) => tagKey(other) !== tagKey(tag)))}
                disabled={disabled}
                aria-label={`${tag.name} нэрийг хасах`}
                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <div className="relative">
          <input
            type="text"
            value={query}
            disabled={disabled}
            maxLength={MAX_POST_TAG_NAME}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            // Сонголт дээр дарах хугацаа үлдээнэ
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTyped();
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Гишүүний нэрээр хайх, эсвэл нэр бичээд Enter"
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30"
          />

          {open && (matches.length > 0 || trimmed) && (
            <ul className="absolute left-0 right-0 top-11 z-20 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-gray-900">
              {matches.map((member) => (
                <li key={member.uid}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => add({ uid: member.uid, name: member.name })}
                    className="w-full px-3 py-2 text-left text-theme-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    {member.name}
                  </button>
                </li>
              ))}
              {trimmed && !matches.some((member) => member.name.toLowerCase() === trimmed.toLowerCase()) && (
                <li>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={addTyped}
                    className="w-full px-3 py-2 text-left text-theme-sm text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5"
                  >
                    «{trimmed}» нэрийг нэмэх
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
