"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  FolderKanban,
  Plus,
  RefreshCw,
  User as UserIcon,
} from "lucide-react";

import { useUser } from "@/app/(auth)/UserProvider";
import ExportButton from "@/components/common/ExportButton";
import { labelOf, aimags } from "@/data/profileOptions";
import {
  taskPriorityLabels,
  taskStatusLabels,
  taskStatuses,
  type TaskStatus,
} from "@/data/taskOptions";
import { isAdminRole } from "@/lib/permissions";
import {
  listProjects,
  listTasks,
  updateTask,
  type Project,
  type Task,
} from "@/lib/tasks";
import { listUsers, type AppUser } from "@/lib/users";

import ProjectManagerModal from "./ProjectManagerModal";
import TaskFormModal from "./TaskFormModal";
import { useBoardDrag } from "./useBoardDrag";

/** Багана бүрийн өнгө — төлөвийг харцаар ялгахад */
const columnStyles: Record<TaskStatus, string> = {
  todo: "bg-gray-400",
  in_progress: "bg-accent-500",
  done: "bg-success-500",
};

const priorityStyles: Record<string, string> = {
  low: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  normal:
    "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400",
  high: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
};

const shortDate = new Intl.DateTimeFormat("mn-MN", {
  month: "2-digit",
  day: "2-digit",
});

/** Өнөөдрийн огноо YYYY-MM-DD — орон нутгийн цагаар (UTC руу шилжүүлэхгүй) */
function todayIso() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

const ALL = "__all__";

/**
 * Ажлын даалгаврын канбан самбар.
 *
 * Уншихыг бүх хэрэглэгчид нээлттэй; даалгавар үүсгэх, оноох нь админы эрх.
 * Гүйцэтгэгч өөрт оногдсон картаа багана хооронд чирж төлөвөө шинэчилнэ.
 */
export default function TaskBoard() {
  const { user } = useUser();
  const isAdmin = isAdminRole(user?.role);
  const myUid = user?.uid ?? "";

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [projectFilter, setProjectFilter] = useState(ALL);
  const [onlyMine, setOnlyMine] = useState(false);

  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [isProjectsOpen, setProjectsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [projectRows, taskRows] = await Promise.all([
        listProjects(),
        listTasks(),
      ]);
      setProjects(projectRows);
      setTasks(taskRows);
    } catch (err) {
      console.error("Ажлын мэдээлэл ачаалж чадсангүй:", err);
      setError("Мэдээлэл ачаалахад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Гүйцэтгэгч сонгох жагсаалтыг зөвхөн админ уншиж чадна
  useEffect(() => {
    if (!isAdmin) return;

    listUsers()
      .then((rows) => setPeople(rows.filter((row) => row.status === "active")))
      .catch((err) => console.error("Хэрэглэгчид уншихад алдаа гарлаа:", err));
  }, [isAdmin]);

  const visible = useMemo(() => {
    return tasks.filter((task) => {
      if (projectFilter !== ALL && task.projectId !== projectFilter) {
        return false;
      }
      if (onlyMine && task.assignedTo !== myUid) return false;
      return true;
    });
  }, [tasks, projectFilter, onlyMine, myUid]);

  const today = todayIso();

  /** Тухайн даалгаврыг энэ хэрэглэгч хөдөлгөж чадах эсэх */
  const canMove = useCallback(
    (task: Task) => isAdmin || task.assignedTo === myUid,
    [isAdmin, myUid]
  );

  const moveTask = useCallback(
    async (task: Task, status: TaskStatus) => {
      if (task.status === status || !canMove(task)) return;

      // Хариу ирэхээс өмнө картыг шилжүүлнэ — чирэлт хүлээлтгүй мэдрэгдэнэ
      setTasks((prev) =>
        prev.map((item) => (item.id === task.id ? { ...item, status } : item))
      );

      try {
        const updated = await updateTask(task.id, { status });
        setTasks((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
      } catch (err) {
        console.error("Төлөв солиход алдаа гарлаа:", err);
        setError(
          err instanceof Error ? err.message : "Төлөв солиход алдаа гарлаа."
        );
        load();
      }
    },
    [canMove, load]
  );

  const {
    dragTask,
    ghost,
    overStatus,
    startGesture,
    registerColumn,
    wasDragging,
  } = useBoardDrag(moveTask);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openTask = (task: Task) => {
    setEditing(task);
    setFormOpen(true);
  };

  const buttonClass =
    "flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300";

  return (
    <div className="flex flex-col gap-5">
      {/* Төслүүд */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setProjectFilter(ALL)}
          className={`rounded-lg border px-3.5 py-2 text-theme-sm font-medium transition-colors ${
            projectFilter === ALL
              ? "border-accent-500 bg-accent-50/60 text-accent-700 dark:border-accent-500 dark:bg-accent-500/10 dark:text-accent-400"
              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          }`}
        >
          Бүх төсөл
        </button>

        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => setProjectFilter(project.id)}
            title={
              project.aimag ? labelOf(aimags, project.aimag) : "Бусад төсөл"
            }
            className={`rounded-lg border px-3.5 py-2 text-theme-sm font-medium transition-colors ${
              projectFilter === project.id
                ? "border-accent-500 bg-accent-50/60 text-accent-700 dark:border-accent-500 dark:bg-accent-500/10 dark:text-accent-400"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
            }`}
          >
            {project.name}
            <span className="ml-1.5 text-theme-xs text-gray-400">
              {project.openCount}
            </span>
          </button>
        ))}
      </div>

      {/* Үйлдэл */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOnlyMine((prev) => !prev)}
          className={`flex h-10 items-center gap-2 rounded-lg border px-3.5 text-theme-sm font-medium transition-colors ${
            onlyMine
              ? "border-accent-500 bg-accent-50/60 text-accent-700 dark:border-accent-500 dark:bg-accent-500/10 dark:text-accent-400"
              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          }`}
        >
          <UserIcon className="h-4 w-4" strokeWidth={1.8} />
          Надад оногдсон
        </button>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className={buttonClass}
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            strokeWidth={1.8}
          />
          Сэргээх
        </button>

        <ExportButton dataset="tasks" />

        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => setProjectsOpen(true)}
              className={buttonClass}
            >
              <FolderKanban className="h-4 w-4" strokeWidth={1.8} />
              Төслүүд
            </button>

            <button
              type="button"
              onClick={openNew}
              disabled={projects.length === 0}
              title={
                projects.length === 0
                  ? "Эхлээд төсөл үүсгэнэ үү"
                  : "Шинэ даалгавар"
              }
              className="flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-3.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              Даалгавар үүсгэх
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      {!loading && projects.length === 0 && (
        <div className="surface flex min-h-[240px] flex-col items-center justify-center gap-2 p-6 text-center">
          <ClipboardList
            className="h-9 w-9 text-gray-300 dark:text-gray-600"
            strokeWidth={1.5}
          />
          <p className="text-base font-medium text-gray-800 dark:text-white/90">
            Төсөл байхгүй байна
          </p>
          <p className="max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
            {isAdmin
              ? "«Төслүүд» цэснээс аймгийн болон бусад төслөө үүсгээд ажлын даалгавар оноож эхлээрэй."
              : "Админ төсөл үүсгэсний дараа ажлын даалгавар энд харагдана."}
          </p>
        </div>
      )}

      {/* Канбан */}
      {projects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {taskStatuses.map((status) => {
            const column = visible
              .filter((task) => task.status === status)
              .sort((a, b) => a.position - b.position);

            return (
              <section
                key={status}
                ref={registerColumn(status)}
                className={`surface flex min-h-[220px] flex-col gap-2 p-4 transition-colors ${
                  dragTask && dragTask.status !== status
                    ? overStatus === status
                      ? "ring-2 ring-accent-500"
                      : "ring-1 ring-accent-400/40"
                    : ""
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${columnStyles[status]}`}
                  />
                  <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
                    {taskStatusLabels[status]}
                  </h2>
                  <span className="text-theme-xs text-gray-400">
                    {column.length}
                  </span>
                </div>

                {column.length === 0 && (
                  <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-theme-xs text-gray-400 dark:border-white/10">
                    Хоосон
                  </p>
                )}

                {column.map((task) => {
                  const overdue =
                    task.dueDate !== "" &&
                    task.dueDate < today &&
                    task.status !== "done";

                  return (
                    <article
                      key={task.id}
                      onPointerDown={
                        canMove(task) ? startGesture(task) : undefined
                      }
                      onClick={() => {
                        // Чирэлтийн дараах click-ээр цонх нээгдэх ёсгүй
                        if (wasDragging()) return;
                        openTask(task);
                      }}
                      className={`cursor-pointer select-none rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:border-accent-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-accent-500/40 ${
                        dragTask?.id === task.id ? "opacity-40" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 text-theme-sm font-medium text-gray-900 dark:text-white">
                          {task.title}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-theme-xs font-medium ${priorityStyles[task.priority]}`}
                        >
                          {taskPriorityLabels[task.priority]}
                        </span>
                      </div>

                      {projectFilter === ALL && (
                        <p className="mt-1 text-theme-xs text-gray-400">
                          {task.projectName}
                        </p>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {task.assignedTo ? (
                          <span className="flex items-center gap-1.5 text-theme-xs text-gray-600 dark:text-gray-400">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-100 text-[10px] font-semibold text-accent-700 dark:bg-accent-500/20 dark:text-accent-300">
                              {initialsOf(task.assigneeName)}
                            </span>
                            {task.assigneeName}
                          </span>
                        ) : (
                          <span className="text-theme-xs text-gray-400">
                            Хуваарилаагүй
                          </span>
                        )}

                        {task.dueDate && (
                          <span
                            className={`ml-auto flex items-center gap-1 text-theme-xs ${
                              overdue
                                ? "font-medium text-error-500"
                                : "text-gray-400"
                            }`}
                          >
                            <CalendarDays
                              className="h-3.5 w-3.5"
                              strokeWidth={1.8}
                            />
                            {shortDate.format(new Date(`${task.dueDate}T00:00`))}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      {/* Чирэгдэж буй картын сүүдэр — хуруу/хулганы араас дагана */}
      {dragTask && ghost && (
        <div
          style={{ left: ghost.x, top: ghost.y }}
          className="pointer-events-none fixed z-999999 max-w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-accent-400 bg-white px-3 py-2 text-theme-sm font-medium text-gray-900 shadow-lg dark:bg-gray-900 dark:text-white"
        >
          {dragTask.title}
        </div>
      )}

      <TaskFormModal
        isOpen={isFormOpen}
        task={editing}
        projects={projects}
        people={people}
        canEdit={isAdmin}
        canMove={editing ? canMove(editing) : false}
        defaultProjectId={projectFilter === ALL ? "" : projectFilter}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />

      <ProjectManagerModal
        isOpen={isProjectsOpen}
        projects={projects}
        onClose={() => setProjectsOpen(false)}
        onChanged={load}
      />
    </div>
  );
}
