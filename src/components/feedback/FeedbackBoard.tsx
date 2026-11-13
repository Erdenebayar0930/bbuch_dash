"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ImagePlus,
  MessageSquarePlus,
  RefreshCw,
  Reply,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import {
  MAX_FEEDBACK_IMAGES,
  feedbackNoteRequired,
  feedbackStatusLabels,
  feedbackStatuses,
  feedbackSteps,
  type FeedbackStatus,
} from "@/data/feedbackOptions";
import {
  createFeedback,
  deleteFeedback,
  listFeedback,
  replyToFeedback,
  updateFeedbackStatus,
  type Feedback,
} from "@/lib/feedback";
import { isAdminRole } from "@/lib/permissions";

const dateFormatter = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const badgeStyles: Record<FeedbackStatus, string> = {
  pending: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  needs_info:
    "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  accepted:
    "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400",
  in_system:
    "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400",
  fixed:
    "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  rejected: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
};

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90";

const ALL = "__all__";

/**
 * Санал хүсэлт — хэн ч бичнэ, бүгд жагсаалтаар явцтай нь харна.
 * Явцыг зөвхөн админ сольдог; татгалзвал шалтгаанаа заавал бичнэ.
 */
export default function FeedbackBoard() {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);

  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>(ALL);

  const fetchAll = () =>
    listFeedback()
      .then((rows) => {
        setItems(rows);
        setError("");
      })
      .catch((err) => {
        console.error("Санал хүсэлт ачаалахад алдаа гарлаа:", err);
        setError("Ачаалахад алдаа гарлаа.");
      })
      .finally(() => setLoading(false));

  // Анхны ачаалал — `loading` нь аль хэдийн true тул энд state тохируулахгүй
  useEffect(() => {
    fetchAll();
  }, []);

  const load = () => {
    setLoading(true);
    fetchAll();
  };

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const item of items) {
      result.set(item.status, (result.get(item.status) ?? 0) + 1);
    }
    return result;
  }, [items]);

  const visible =
    filter === ALL ? items : items.filter((item) => item.status === filter);

  const replace = (updated: Feedback) =>
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );

  const chipClass = (active: boolean) =>
    `rounded-lg border px-3.5 py-2 text-theme-sm font-medium transition-colors ${
      active
        ? "border-accent-500 bg-accent-50/60 text-accent-700 dark:border-accent-500 dark:bg-accent-500/10 dark:text-accent-400"
        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
    }`;

  return (
    <div className="flex flex-col gap-5">
      {user?.uid && (
        <FeedbackForm
          uid={user.uid}
          onCreated={(created) => {
            setItems((prev) => [created, ...prev]);
            setFilter(ALL);
          }}
        />
      )}

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter(ALL)}
          className={chipClass(filter === ALL)}
        >
          Бүгд
          <span className="ml-1.5 text-theme-xs text-gray-400">
            {items.length}
          </span>
        </button>
        {feedbackStatuses.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={chipClass(filter === status)}
          >
            {feedbackStatusLabels[status]}
            <span className="ml-1.5 text-theme-xs text-gray-400">
              {counts.get(status) ?? 0}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={load}
          disabled={loading}
          aria-label="Шинэчлэх"
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            strokeWidth={1.8}
          />
        </button>
      </div>

      {loading && items.length === 0 && (
        <p className="surface px-5 py-10 text-center text-theme-sm text-gray-500">
          Ачаалж байна...
        </p>
      )}

      {!loading && visible.length === 0 && (
        <div className="surface flex flex-col items-center gap-2 px-5 py-14 text-center">
          <MessageSquarePlus
            className="h-9 w-9 text-gray-300 dark:text-gray-600"
            strokeWidth={1.5}
          />
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Санал хүсэлт алга.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {visible.map((item) => (
          <FeedbackCard
            key={item.id}
            item={item}
            isAdmin={isAdmin}
            myUid={user?.uid ?? ""}
            onUpdated={replace}
            onDeleted={() =>
              setItems((prev) => prev.filter((row) => row.id !== item.id))
            }
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Илгээх маягт
// ---------------------------------------------------------------------------

function FeedbackForm({
  uid,
  onCreated,
}: {
  uid: string;
  onCreated: (item: Feedback) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Сонгосон зургийн урьдчилсан харагдац — солигдох бүрд хуучин URL-ыг чөлөөлнө
  const previews = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files]
  );
  useEffect(
    () => () => previews.forEach((url) => URL.revokeObjectURL(url)),
    [previews]
  );

  const pickFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith("image/")
    );
    event.target.value = "";

    setFiles((prev) => {
      const next = [...prev, ...picked];
      if (next.length > MAX_FEEDBACK_IMAGES) {
        setError(`Хамгийн ихдээ ${MAX_FEEDBACK_IMAGES} зураг оруулна.`);
      }
      return next.slice(0, MAX_FEEDBACK_IMAGES);
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    setBusy(true);
    setError("");

    try {
      const created = await createFeedback(uid, {
        title: title.trim(),
        body: body.trim(),
        files,
      });
      onCreated(created);
      setTitle("");
      setBody("");
      setFiles([]);
    } catch (err) {
      console.error("Санал хүсэлт илгээхэд алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Илгээж чадсангүй.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface flex flex-col gap-3 p-5">
      <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
        Санал хүсэлт илгээх
      </h3>

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Гарчиг — товчхон юуны тухай вэ"
        maxLength={255}
        required
        className={`${inputClass} h-10`}
      />
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Дэлгэрэнгүй тайлбар"
        rows={4}
        maxLength={5000}
        className={`${inputClass} resize-y py-2.5`}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={pickFiles}
      />

      <div className="flex flex-wrap items-center gap-2">
        {previews.map((url, index) => (
          <div
            key={url}
            className="relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200 dark:border-white/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label="Зураг хасах"
              onClick={() =>
                setFiles((prev) => prev.filter((_, i) => i !== index))
              }
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="h-3 w-3" strokeWidth={2.5} />
            </button>
          </div>
        ))}

        {files.length < MAX_FEEDBACK_IMAGES && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-16 items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3.5 text-theme-sm text-gray-500 transition-colors hover:bg-gray-50 dark:border-white/15 dark:text-gray-400 dark:hover:bg-white/5"
          >
            <ImagePlus className="h-4 w-4" strokeWidth={1.8} />
            Зураг нэмэх
          </button>
        )}
      </div>

      {error && (
        <p className="text-theme-sm text-error-600 dark:text-error-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !title.trim()}
        className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg bg-accent-600 px-4 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Илгээж байна..." : "Илгээх"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Явцын шат
// ---------------------------------------------------------------------------

function ProgressSteps({ status }: { status: FeedbackStatus }) {
  // "Нэмэлт тайлбар" нь хүлээн авахаас өмнөх шатанд зогссон гэж харуулна;
  // "Татгалзсан" бол урсгал тасарсан тул шатыг харуулахгүй.
  const current = status === "needs_info" ? 0 : feedbackSteps.indexOf(status);

  return (
    <ol className="flex items-center gap-1.5">
      {feedbackSteps.map((step, index) => {
        const done = index < current || (index === current && step === "fixed");
        const active = index === current && !done;

        return (
          <li key={step} className="flex min-w-0 flex-1 flex-col gap-1">
            <span
              className={`h-1.5 rounded-full ${
                done
                  ? "bg-success-500"
                  : active
                    ? "bg-accent-500"
                    : "bg-gray-200 dark:bg-white/10"
              }`}
            />
            <span
              className={`flex items-center gap-1 truncate text-theme-xs ${
                done || active
                  ? "text-gray-700 dark:text-gray-300"
                  : "text-gray-400"
              }`}
            >
              {done && <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} />}
              {feedbackStatusLabels[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Нэг санал хүсэлт
// ---------------------------------------------------------------------------

function FeedbackCard({
  item,
  isAdmin,
  myUid,
  onUpdated,
  onDeleted,
}: {
  item: Feedback;
  isAdmin: boolean;
  myUid: string;
  onUpdated: (item: Feedback) => void;
  onDeleted: () => void;
}) {
  const [status, setStatus] = useState<FeedbackStatus>(item.status);
  const [note, setNote] = useState(item.adminNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [reply, setReply] = useState("");

  const noteRequired = feedbackNoteRequired.includes(status);
  const canReply =
    item.status === "needs_info" && !!myUid && item.authorUid === myUid;

  // Хариу бичигдсэний дараа adminNote нь тэр асуулт хэвээр үлддэг — ярианы
  // түүхэнд аль хэдийн харагдаж байгаа тул давхар хайрцаг гаргахгүй
  const lastReply = item.replies[item.replies.length - 1];
  const noteAnswered =
    item.status !== "needs_info" &&
    !!lastReply &&
    lastReply.question === item.adminNote;

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reply.trim()) return;

    setBusy(true);
    setError("");

    try {
      const updated = await replyToFeedback(item.id, reply.trim());
      setReply("");
      setStatus(updated.status);
      setNote(updated.adminNote);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Илгээж чадсангүй.");
    } finally {
      setBusy(false);
    }
  };
  const dirty = status !== item.status || note.trim() !== item.adminNote;

  const save = async () => {
    if (noteRequired && !note.trim()) {
      setError(
        status === "rejected"
          ? "Татгалзсан шалтгааныг бичнэ үү."
          : "Ямар нэмэлт тайлбар хэрэгтэйг бичнэ үү."
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      onUpdated(await updateFeedbackStatus(item.id, status, note.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалж чадсангүй.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`«${item.title}» санал хүсэлтийг устгах уу?`)) return;

    setBusy(true);
    setError("");

    try {
      await deleteFeedback(item.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Устгаж чадсангүй.");
      setBusy(false);
    }
  };

  return (
    <article
      className={`surface flex flex-col gap-4 p-5 ${busy ? "opacity-60" : ""}`}
    >
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {item.title}
          </h3>
          <p className="mt-0.5 text-theme-xs text-gray-400">
            {item.authorName} · {dateFormatter.format(item.createdAt)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-theme-xs font-medium ${badgeStyles[item.status]}`}
        >
          {feedbackStatusLabels[item.status]}
        </span>
      </header>

      {item.body && (
        <p className="whitespace-pre-wrap text-theme-sm text-gray-700 dark:text-gray-300">
          {item.body}
        </p>
      )}

      {item.images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.images.map((image) => (
            <a
              key={image.path}
              href={image.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-20 w-20 overflow-hidden rounded-lg border border-gray-200 dark:border-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {item.replies.length > 0 && (
        <div className="flex flex-col gap-2.5 border-l-2 border-gray-100 pl-4 dark:border-white/10">
          {item.replies.map((entry, index) => (
            <div key={index} className="flex flex-col gap-1 text-theme-sm">
              {entry.question && (
                <p className="text-gray-500 dark:text-gray-400">
                  <span className="font-medium">Админ:</span> {entry.question}
                </p>
              )}
              <p className="whitespace-pre-wrap text-gray-800 dark:text-white/90">
                <span className="font-medium">{item.authorName}:</span>{" "}
                {entry.text}
              </p>
              <p className="text-theme-xs text-gray-400">
                {dateFormatter.format(entry.at)}
              </p>
            </div>
          ))}
        </div>
      )}

      {item.status === "rejected" ? (
        <div className="flex gap-2.5 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-700 dark:bg-error-500/10 dark:text-error-400">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <div>
            <p className="font-medium">Татгалзсан шалтгаан</p>
            <p className="mt-0.5 whitespace-pre-wrap">{item.adminNote}</p>
          </div>
        </div>
      ) : (
        <>
          <ProgressSteps status={item.status} />
          {item.adminNote && !noteAnswered && (
            <div
              className={`flex gap-2.5 rounded-lg px-4 py-3 text-theme-sm ${
                item.status === "needs_info"
                  ? "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400"
                  : "bg-gray-50 text-gray-700 dark:bg-white/[0.03] dark:text-gray-300"
              }`}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              <div>
                <p className="font-medium">
                  {item.status === "needs_info"
                    ? "Нэмэлт тайлбар хэрэгтэй"
                    : "Админы тайлбар"}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap">{item.adminNote}</p>
              </div>
            </div>
          )}
        </>
      )}

      {canReply && (
        <form
          onSubmit={sendReply}
          className="flex flex-col gap-2 border-t border-gray-100 pt-4 dark:border-white/5"
        >
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Нэмэлт тайлбараа бичнэ үү"
            className={`${inputClass} resize-y py-2.5`}
          />
          <button
            type="submit"
            disabled={busy || !reply.trim()}
            className="inline-flex h-10 items-center gap-2 self-start rounded-lg bg-accent-600 px-4 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Reply className="h-4 w-4" strokeWidth={1.8} />
            {busy ? "Илгээж байна..." : "Хариу илгээх"}
          </button>
        </form>
      )}

      {isAdmin && (
        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 dark:border-white/5">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as FeedbackStatus)
              }
              className={`${inputClass} h-10 w-auto`}
            >
              {feedbackStatuses.map((option) => (
                <option key={option} value={option}>
                  {feedbackStatusLabels[option]}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={save}
              disabled={busy || !dirty}
              className="inline-flex h-10 items-center rounded-lg bg-accent-600 px-4 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Хадгалах
            </button>

            <button
              type="button"
              onClick={remove}
              disabled={busy}
              aria-label="Устгах"
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-error-500 transition-colors hover:bg-error-50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-error-500/10"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>

          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={
              status === "rejected"
                ? "Яагаад татгалзсан бэ (заавал)"
                : status === "needs_info"
                  ? "Ямар нэмэлт тайлбар хэрэгтэй вэ (заавал)"
                  : "Тайлбар (заавал биш)"
            }
            className={`${inputClass} resize-y py-2.5`}
          />

          {error && (
            <p className="text-theme-sm text-error-600 dark:text-error-400">
              {error}
            </p>
          )}
        </div>
      )}

      {!isAdmin && error && (
        <p className="text-theme-sm text-error-600 dark:text-error-400">
          {error}
        </p>
      )}
    </article>
  );
}
