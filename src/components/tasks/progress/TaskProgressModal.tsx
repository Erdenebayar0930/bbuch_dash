"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarDays, FolderOpen, ListChecks, MessageSquareText } from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import ImageViewer from "@/components/common/ImageViewer";
import PostCard from "@/components/posts/PostCard";
import PostComposer from "@/components/posts/PostComposer";
import { Modal } from "@/components/ui/modal";
import { isAdminRole } from "@/lib/permissions";
import type { PostInput } from "@/lib/posts";
import type { Task } from "@/lib/tasks";
import {
  addScheduleItem,
  asPost,
  createTaskUpdate,
  deleteScheduleItem,
  deleteTaskUpdate,
  listSchedule,
  listTaskUpdates,
  setScheduleDone,
  voteTaskPoll,
  type ScheduleItem,
  type TaskUpdate,
} from "@/lib/taskProgress";

import { PollEditor, PollView, emptyPoll, pollReady, type PollDraft } from "./Poll";
import ProgressCalendar from "./ProgressCalendar";
import ProgressFiles from "./ProgressFiles";
import ScheduleList from "./ScheduleList";

type TabKey = "progress" | "schedule" | "calendar" | "files";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "progress", label: "Явц", icon: MessageSquareText },
  { key: "schedule", label: "Хуваарь", icon: ListChecks },
  { key: "calendar", label: "Календарь", icon: CalendarDays },
  { key: "files", label: "Файлууд", icon: FolderOpen },
];

/**
 * Төлөвлөгөөний даалгаврын ажлын явц — «Хийгдэж байна» баганын карт бүрээс нээгдэнэ.
 *
 * • Явц — явцын мэдээлэл (бичвэр, зураг, бичлэг, файл, санал асуулга)
 * • Хуваарь — огноотой үе шатууд, хийгдсэнийг тэмдэглэнэ
 * • Календарь — хуваарь, явц, эцсийн хугацааг сараар
 * • Файлууд — бүх явцад хавсаргасан файл нэг дор
 */
export default function TaskProgressModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);

  const [tab, setTab] = useState<TabKey>("progress");
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [poll, setPoll] = useState<PollDraft | null>(null);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const taskId = task?.id ?? null;

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError("");
    try {
      const [progress, schedule] = await Promise.all([listTaskUpdates(taskId), listSchedule(taskId)]);
      setUpdates(progress.updates);
      setItems(schedule.items);
      setCanManage(schedule.canManage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    setTab("progress");
    setPoll(null);
    setFocusId(null);
    setUpdates([]);
    setItems([]);
    void load();
  }, [taskId, load]);

  // Календариас сонгосон явц руу гүйлгэнэ
  useEffect(() => {
    if (tab !== "progress" || !focusId) return;
    document.getElementById(`task-update-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [tab, focusId]);

  if (!task) return null;

  const replace = (next: TaskUpdate) =>
    setUpdates((prev) => prev.map((item) => (item.id === next.id ? next : item)));

  const publish = async (input: PostInput) => {
    if (!user?.uid) throw new Error("Нэвтэрсэн байх шаардлагатай.");
    const created = await createTaskUpdate(user.uid, task.id, {
      ...input,
      poll:
        poll && pollReady(poll)
          ? {
              question: poll.question.trim(),
              options: poll.options.map((option) => option.trim()).filter(Boolean),
              multi: poll.multi,
            }
          : null,
    });
    setUpdates((prev) =>
      [created, ...prev].sort(
        (a, b) => b.period.localeCompare(a.period) || b.createdAt.getTime() - a.createdAt.getTime()
      )
    );
    return true;
  };

  const remove = async (update: TaskUpdate) => {
    if (!window.confirm("Энэ явцын мэдээллийг устгах уу?")) return;
    try {
      await deleteTaskUpdate(task.id, update);
      setUpdates((prev) => prev.filter((item) => item.id !== update.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    }
  };

  const fileCount = updates.reduce((sum, update) => sum + update.media.length, 0);

  return (
    <Modal isOpen={!!task} onClose={onClose} className="m-4 max-w-[860px]">
      <div className="flex max-h-[88vh] flex-col">
        <div className="border-b border-gray-200 px-5 pb-0 pt-5 dark:border-white/10">
          <p className="text-theme-xs font-medium text-accent-600 dark:text-accent-400">Ажлын явц</p>
          <h2 className="mt-0.5 pr-10 text-lg font-semibold text-gray-900 dark:text-white">{task.title}</h2>
          {task.dueDate && (
            <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
              Эцсийн хугацаа {task.dueDate}
            </p>
          )}

          <div role="tablist" aria-label="Ажлын явц" className="no-scrollbar mt-3 flex gap-x-1 overflow-x-auto overflow-y-hidden">
            {TABS.map(({ key, label, icon: Icon }) => {
              const selected = key === tab;
              const count = key === "progress" ? updates.length : key === "schedule" ? items.length : key === "files" ? fileCount : 0;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(key)}
                  className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-theme-sm font-medium transition-colors ${
                    selected
                      ? "border-accent-600 text-accent-700 dark:border-accent-400 dark:text-accent-300"
                      : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                  {label}
                  {count > 0 && (
                    <span className="rounded-full bg-gray-100 px-1.5 text-theme-xs text-gray-500 dark:bg-white/10 dark:text-gray-400">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <p className="mb-4 rounded-lg bg-error-50 px-4 py-2.5 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
              {error}
            </p>
          )}

          {loading && updates.length === 0 && items.length === 0 ? (
            <p className="py-10 text-center text-theme-sm text-gray-500">Ачаалж байна...</p>
          ) : tab === "progress" ? (
            <div className="flex flex-col gap-4">
              <div className="surface p-4">
                <PostComposer
                  submitLabel="Явц оруулах"
                  placeholder="Ажлын явцыг бичнэ үү — юу хийгдсэн, юу үлдсэн…"
                  onSubmit={publish}
                  extraReady={!!poll && pollReady(poll)}
                  extraInvalid={!!poll && !pollReady(poll)}
                  onReset={() => setPoll(null)}
                  extra={
                    poll ? (
                      <PollEditor value={poll} onChange={setPoll} onRemove={() => setPoll(null)} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPoll(emptyPoll())}
                        className="inline-flex h-9 items-center gap-2 self-start rounded-lg px-3 text-theme-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                      >
                        <BarChart3 className="h-5 w-5 text-accent-600 dark:text-accent-400" strokeWidth={1.8} />
                        Poll — санал асуулга үүсгэх
                      </button>
                    )
                  }
                />
              </div>

              {updates.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-theme-sm text-gray-400 dark:border-white/10">
                  Явцын мэдээлэл оруулаагүй байна.
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {updates.map((update) => {
                    const own = !!user?.uid && update.authorUid === user.uid;
                    return (
                      <li
                        key={update.id}
                        id={`task-update-${update.id}`}
                        className={focusId === update.id ? "rounded-2xl ring-2 ring-accent-400" : undefined}
                      >
                        <PostCard
                          post={asPost(update)}
                          canEdit={false}
                          canDelete={own || isAdmin}
                          onEdit={() => {}}
                          onDelete={() => remove(update)}
                          onOpenImage={setViewerSrc}
                          footer={
                            update.poll ? (
                              <div className="pb-1">
                                <PollView
                                  update={update}
                                  onVote={async (optionIds) =>
                                    replace(await voteTaskPoll(task.id, update.id, optionIds))
                                  }
                                />
                              </div>
                            ) : undefined
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : tab === "schedule" ? (
            <ScheduleList
              items={items}
              canManage={canManage}
              onAdd={async (input) => {
                const item = await addScheduleItem(task.id, input);
                setItems((prev) => [...prev, item].sort((a, b) => a.startDate.localeCompare(b.startDate)));
              }}
              onToggle={async (item) => {
                const next = await setScheduleDone(task.id, item.id, !item.done);
                setItems((prev) => prev.map((other) => (other.id === next.id ? next : other)));
              }}
              onDelete={async (item) => {
                await deleteScheduleItem(task.id, item.id);
                setItems((prev) => prev.filter((other) => other.id !== item.id));
              }}
            />
          ) : tab === "calendar" ? (
            <ProgressCalendar
              items={items}
              updates={updates}
              dueDate={task.dueDate}
              onOpenUpdate={(update) => {
                setFocusId(update.id);
                setTab("progress");
              }}
            />
          ) : (
            <ProgressFiles updates={updates} onOpenImage={setViewerSrc} />
          )}
        </div>
      </div>

      <ImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </Modal>
  );
}
