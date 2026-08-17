"use client";

import { BellRing, Loader2, Send, Sparkles, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { sendNotificationToAllUsers, sendNotificationToUser } from "@/lib/fcm";
import { listUsers, type AppUser } from "@/lib/users";

import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";

type Audience = "all" | "user";
type Feedback = { type: "success" | "error" | "info"; text: string };

type TemplateItem = {
  key: string;
  label: string;
  audience: Audience;
  title: string;
  body: string;
};

const notificationTemplates: TemplateItem[] = [
  {
    key: "service",
    label: "Үйлчилгээний мэдээ",
    audience: "all",
    title: "Системийн шинэчлэлт эхэллээ",
    body: "Системийн шинэчлэл дууссаны дараа үйлчилгээг илүү тогтвортой ажиллуулна.",
  },
  {
    key: "reminder",
    label: "Санамж",
    audience: "all",
    title: "Бүртгэлээ шинэчилнэ үү",
    body: "Мэдээлэлээ шинэчилж, идэвхтэй статустай байгаарай.",
  },
];

export default function SendNotification() {
  const [audience, setAudience] = useState<Audience>("all");
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  /** Нэрээр хайх талбарын текст — сонголт хийгдмэгц хоосорно */
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [message, setMessage] = useState<Feedback | null>(null);

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      setUsers(await listUsers());
    } catch (error) {
      console.error("Хэрэглэгчдийг ачаалж чадсангүй:", error);
      setUsers([]);
      setMessage({
        type: "error",
        text: "Хэрэглэгчийн жагсаалтыг ачаалж чадсангүй.",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const recipientCount = useMemo(() => {
    if (audience === "user") {
      return userId ? 1 : 0;
    }

    return users.filter((user) => user.status === "active").length;
  }, [audience, userId, users]);

  const displayName = (user: AppUser) =>
    [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;

  const selectedUser = useMemo(
    () => users.find((user) => user.uid === userId) ?? null,
    [users, userId]
  );

  /**
   * Нэр, имэйлээр хайна. Хэрэглэгч uid-г огт харахгүй тул хайлт нь
   * сонгох цорын ганц зам — жагсаалтыг богино байлгаж 8-аар таслав.
   */
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];

    return users
      .filter((user) =>
        `${displayName(user)} ${user.email}`.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [search, users]);

  const applyTemplate = (template: TemplateItem) => {
    setAudience(template.audience);
    setTitle(template.title);
    setBody(template.body);
    setMessage(null);
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim() || !body.trim()) {
      setMessage({ type: "error", text: "Гарчиг болон агуулгыг бөглөнө үү." });
      return;
    }

    if (audience === "user" && !userId) {
      setMessage({ type: "error", text: "Хүлээн авах хэрэглэгчээ сонгоно уу." });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const data: Record<string, string> = {};
      if (url.trim()) data.url = url.trim();

      const result =
        audience === "all"
          ? await sendNotificationToAllUsers(title.trim(), body.trim(), data)
          : await sendNotificationToUser(userId, title.trim(), body.trim(), data);

      // Мэдэгдэл нь DB-д бичигдсэн бол хүрсэнд тооцно — push нь зөвхөн
      // мэдэгдүүлэг. Хэрэглэгч апп нээхэд уншаагүй төлөвтэй хүлээж байна.
      const notes = [
        result.sent > 0 ? `${result.sent} төхөөрөмжид push очлоо` : null,
        result.withoutToken > 0
          ? `${result.withoutToken} хэрэглэгч push идэвхжүүлээгүй`
          : null,
        result.failed > 0 ? `${result.failed} push амжилтгүй` : null,
      ].filter(Boolean);

      if (result.recipients === 0) {
        setMessage({
          type: "info",
          text: "Одоогоор энэ чиглэлд идэвхтэй хэрэглэгч олдсонгүй.",
        });
      } else if (result.stored > 0) {
        setMessage({
          type: "success",
          text:
            `${result.stored} хэрэглэгчид мэдэгдэл үүслээ` +
            (notes.length ? ` — ${notes.join(", ")}` : ""),
        });
        setTitle("");
        setBody("");
        setUrl("");
        setUserId("");
        setSearch("");
      } else {
        setMessage({
          type: "error",
          text: `Мэдэгдэл үүсгэж чадсангүй.${
            notes.length ? ` (${notes.join(", ")})` : ""
          }`,
        });
      }
    } catch (error: unknown) {
      console.error("Мэдэгдэл илгээхэд алдаа гарлаа:", error);
      const messageText =
        error instanceof Error
          ? error.message
          : "Мэдэгдэл илгээхэд алдаа гарлаа.";
      setMessage({ type: "error", text: messageText });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 lg:p-6">
      {message && (
        <div
          className={`mb-4 rounded-lg border p-4 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
              : message.type === "info"
                ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSend} className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-3 flex items-center gap-2">
            <BellRing className="h-4 w-4 text-brand-500" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Хүлээн авагч сонгох
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "Бүх хэрэглэгчид" },
              { value: "user", label: "Нэг хэрэглэгч" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setAudience(option.value as Audience)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  audience === option.value
                    ? "bg-brand-500 text-white"
                    : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Users className="h-4 w-4" />
            {audience === "all" && <span>Идэвхтэй бүх хэрэглэгчид</span>}
            {audience === "user" && (
              <span>
                {selectedUser
                  ? displayName(selectedUser)
                  : "Хэрэглэгчээ сонгоно уу"}
              </span>
            )}
          </div>
        </div>

        {audience === "user" && (
          <div>
            <Label>
              Хэрэглэгч <span className="text-error-500">*</span>
            </Label>

            {selectedUser ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {displayName(selectedUser)}
                  </p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {selectedUser.email}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUserId("");
                    setSearch("");
                  }}
                >
                  Солих
                </Button>
              </div>
            ) : (
              <>
                <Input
                  type="text"
                  placeholder="Нэр эсвэл имэйлээр хайх"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />

                {loadingUsers && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Хэрэглэгчдийг ачаалж байна...
                  </p>
                )}

                {!loadingUsers && search.trim() && matches.length === 0 && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Тохирох хэрэглэгч олдсонгүй.
                  </p>
                )}

                {matches.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1.5 dark:border-gray-800 dark:bg-gray-900">
                    {matches.map((user) => (
                      <button
                        key={user.uid}
                        type="button"
                        onClick={() => {
                          setUserId(user.uid);
                          setSearch("");
                          setMessage(null);
                        }}
                        className="block w-full rounded px-2.5 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <span className="block truncate text-sm text-gray-800 dark:text-gray-200">
                          {displayName(user)}
                        </span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {user.email}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Label>
              Загвар <span className="text-error-500">*</span>
            </Label>
            <Sparkles className="h-4 w-4 text-brand-500" />
          </div>
          <div className="flex flex-wrap gap-2">
            {notificationTemplates.map((template) => (
              <button
                key={template.key}
                type="button"
                onClick={() => applyTemplate(template)}
                className="rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-brand-500 hover:text-brand-600 dark:border-gray-700 dark:text-gray-400"
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>
            Гарчиг <span className="text-error-500">*</span>
          </Label>
          <Input
            type="text"
            placeholder="Мэдэгдлийн гарчиг"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </div>

        <div>
          <Label>
            Агуулга <span className="text-error-500">*</span>
          </Label>
          <textarea
            className="w-full rounded-lg border border-gray-200 bg-transparent px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            placeholder="Иргэдэд хүргэх мэдээллээ бичнэ үү"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            rows={4}
          />
        </div>

        <div>
          <Label>URL (заавал биш)</Label>
          <Input
            type="text"
            placeholder="https://example.com/page"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium text-gray-900 dark:text-white">Сонгосон чиглэл:</p>
            <p>
              {audience === "all"
                ? `Бүх идэвхтэй хэрэглэгчид — ${recipientCount} хэрэглэгч`
                : selectedUser
                  ? displayName(selectedUser)
                  : "Хэрэглэгч сонгоогүй"}
            </p>
          </div>
          <Button type="submit" disabled={loading} className="min-w-[180px]" size="sm">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Илгээж байна...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {audience === "all"
                  ? "Бүх хэрэглэгчдэд илгээх"
                  : "Нэг хэрэглэгчид илгээх"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
