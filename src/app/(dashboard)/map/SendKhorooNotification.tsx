"use client";

import { Bell, Loader2, Send, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useUser } from "@/app/(auth)/UserProvider";
import { khoroos } from "@/data/khoroos";
import { sendNotificationToKhoroo } from "@/lib/fcm";
import { listUsers, type AppUser } from "@/lib/users";

type Feedback = { type: "success" | "error" | "info"; text: string };

/** Түгээмэл мэдэгдлийн загварууд — {khoroo} нь сонгосон хорооны нэрээр солигдоно */
const templates: { key: string; name: string; title: string; body: string }[] = [
  {
    key: "schedule",
    name: "Хог тээвэрлэлтийн хуваарь",
    title: "{khoroo} — хог тээвэрлэлтийн хуваарь",
    body: "Маргааш 08:00-10:00 цагт хог ачих машин ирнэ. Хогоо цагтаа гаргана уу.",
  },
  {
    key: "delay",
    name: "Саатал",
    title: "{khoroo} — тээвэрлэлт хойшлов",
    body: "Цаг агаарын нөхцөл байдлаас шалтгаалан хог тээвэрлэлт хойшилж байна. Дэлгэрэнгүйг дараа мэдэгдэнэ.",
  },
  {
    key: "recycle",
    name: "Дахин боловсруулалт",
    title: "{khoroo} — ангилан ялгах өдөр",
    body: "Энэ долоо хоногт хуванцар болон цаасны ангилан ялгалт хийгдэнэ. Тусад нь савлана уу.",
  },
];

export default function SendKhorooNotification({
  selectedKhorooId,
  onSelectKhoroo,
}: {
  selectedKhorooId: number | null;
  onSelectKhoroo: (id: number | null) => void;
}) {
  const { user } = useUser();
  const isAdmin = user?.role === "admin" || user?.role === "super";

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const selected = khoroos.find((k) => k.id === selectedKhorooId) ?? null;

  // Хүлээн авагчийн тоог урьдчилан харуулахын тулд хэрэглэгчдийг ачаална
  const loadUsers = useCallback(async () => {
    try {
      setUsers(await listUsers());
    } catch (error) {
      console.error("Хэрэглэгчдийг ачаалж чадсангүй:", error);
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  const recipientsOf = (id: number) =>
    users?.filter((u) => u.khoroo === id && u.status === "active").length ?? null;

  const recipients = selected ? recipientsOf(selected.id) : null;

  const applyTemplate = (key: string) => {
    const template = templates.find((item) => item.key === key);
    if (!template) return;

    const name = selected?.name ?? "Хороо";
    setTitle(template.title.replace("{khoroo}", name));
    setBody(template.body.replace("{khoroo}", name));
    setFeedback(null);
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selected) {
      setFeedback({ type: "error", text: "Хороо сонгоно уу." });
      return;
    }
    if (!title.trim() || !body.trim()) {
      setFeedback({ type: "error", text: "Гарчиг болон агуулгыг бөглөнө үү." });
      return;
    }

    setSending(true);
    setFeedback(null);

    try {
      const data: { [key: string]: string } = {};
      if (url.trim()) data.url = url.trim();

      const result = await sendNotificationToKhoroo(
        selected.id,
        title.trim(),
        body.trim(),
        data
      );

      if (result.recipients === 0) {
        setFeedback({
          type: "info",
          text: `${selected.name}-нд бүртгэлтэй идэвхтэй хэрэглэгч алга. Хэрэглэгчид профайл дээрээ хороогоо сонгосон байх шаардлагатай.`,
        });
      } else {
        const notes = [
          result.withoutToken > 0
            ? `${result.withoutToken} хэрэглэгч мэдэгдэл зөвшөөрөөгүй`
            : null,
          result.failed > 0 ? `${result.failed} илгээлт амжилтгүй` : null,
        ].filter(Boolean);

        setFeedback({
          type: result.sent > 0 ? "success" : "error",
          text:
            `${selected.name}: ${result.sent}/${result.recipients} хэрэглэгчид илгээгдлээ` +
            (notes.length ? ` (${notes.join(", ")})` : ""),
        });

        if (result.sent > 0) {
          setTitle("");
          setBody("");
          setUrl("");
        }
      }
    } catch (error) {
      console.error("Мэдэгдэл илгээхэд алдаа гарлаа:", error);
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Мэдэгдэл илгээхэд алдаа гарлаа.",
      });
    } finally {
      setSending(false);
    }
  };

  if (!isAdmin) return null;

  const feedbackStyles: Record<Feedback["type"], string> = {
    success:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    error: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    info: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  };

  const inputClass =
    "h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-emerald-400 focus:outline-hidden focus:ring-3 focus:ring-emerald-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center gap-2">
        <Bell className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Хороонд мэдэгдэл илгээх
        </h2>
      </div>

      <form onSubmit={handleSend} className="space-y-4">
        {/* Хороо сонгох — газрын зурагтай хамт синк болно */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Хүлээн авах хороо
          </p>
          <div className="flex flex-wrap gap-2">
            {khoroos.map((khoroo) => {
              const isActive = khoroo.id === selectedKhorooId;
              const count = recipientsOf(khoroo.id);
              return (
                <button
                  key={khoroo.id}
                  type="button"
                  onClick={() => onSelectKhoroo(isActive ? null : khoroo.id)}
                  aria-pressed={isActive}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/5"
                  }`}
                >
                  <span
                    className="khoroo-swatch h-3 w-3 rounded-sm"
                    style={
                      {
                        "--khoroo-color": khoroo.color,
                        "--khoroo-color-dark": khoroo.colorDark,
                      } as React.CSSProperties
                    }
                  />
                  {khoroo.name}
                  {count !== null && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Users className="h-3.5 w-3.5" />
            {selected
              ? recipients === null
                ? "Хүлээн авагчдыг ачаалж байна..."
                : `${selected.name} — ${recipients} идэвхтэй хэрэглэгч`
              : "Газрын зураг дээрх бүс дээр дарж ч сонгож болно."}
          </p>
        </div>

        {/* Загварууд */}
        <div className="flex flex-wrap gap-2">
          {templates.map((template) => (
            <button
              key={template.key}
              type="button"
              onClick={() => applyTemplate(template.key)}
              className="rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-gray-700 dark:text-gray-400 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
            >
              {template.name}
            </button>
          ))}
        </div>

        <div>
          <label
            htmlFor="notification-title"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Гарчиг
          </label>
          <input
            id="notification-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Жишээ нь: 3-р хороо — хог тээвэрлэлтийн хуваарь"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="notification-body"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Агуулга
          </label>
          <textarea
            id="notification-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            placeholder="Иргэдэд хүргэх мэдээллээ бичнэ үү"
            className={`${inputClass} h-auto py-3`}
          />
        </div>

        <div>
          <label
            htmlFor="notification-url"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Холбоос <span className="text-gray-400">(заавал биш)</span>
          </label>
          <input
            id="notification-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="/map"
            className={inputClass}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={sending || !selected}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sending ? "Илгээж байна..." : "Мэдэгдэл илгээх"}
          </button>

          {feedback && (
            <span
              role="status"
              className={`rounded-lg px-3 py-2 text-sm ${feedbackStyles[feedback.type]}`}
            >
              {feedback.text}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
