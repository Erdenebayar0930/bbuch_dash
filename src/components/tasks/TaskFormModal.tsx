"use client";

import React, { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { labelOf, aimags } from "@/data/profileOptions";
import {
  taskPriorities,
  taskPriorityLabels,
  taskStatusLabels,
  taskStatuses,
} from "@/data/taskOptions";
import {
  createTask,
  deleteTask,
  updateTask,
  type Project,
  type Task,
  type TaskInput,
} from "@/lib/tasks";
import type { AppUser } from "@/lib/users";

type TaskFormModalProps = {
  isOpen: boolean;
  /** null бол шинээр үүсгэнэ */
  task: Task | null;
  projects: Project[];
  /** Гүйцэтгэгч сонгоход — зөвхөн админд дүүрэн ирнэ */
  people: AppUser[];
  /** Бүх талбарыг засах эрхтэй эсэх */
  canEdit: boolean;
  /** Зөвхөн төлөвөө сольж чадах эсэх (өөрт оногдсон даалгавар) */
  canMove: boolean;
  /** Шинээр үүсгэхэд урьдчилж сонгогдох төсөл */
  defaultProjectId: string;
  onClose: () => void;
  onSaved: () => void;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

const emptyInput = (projectId: string): TaskInput => ({
  projectId,
  title: "",
  description: "",
  status: "todo",
  priority: "normal",
  assignedTo: null,
  dueDate: "",
});

const personName = (person: AppUser) =>
  [person.first_name, person.last_name].filter(Boolean).join(" ") ||
  person.email;

/** Төслийн нэрийг аймгийнх нь хамт — ижил нэртэй төсөл ялгагдана */
const projectLabel = (project: Project) =>
  project.aimag
    ? `${project.name} · ${labelOf(aimags, project.aimag)}`
    : project.name;

/**
 * Ажлын даалгавар үүсгэх / засах цонх.
 *
 * Эрхээс хамаарч гурван горимд ажиллана: админ бүхнийг засна, гүйцэтгэгч
 * зөвхөн төлөвөө сольно, бусад нь зөвхөн харна.
 */
export default function TaskFormModal({
  isOpen,
  task,
  projects,
  people,
  canEdit,
  canMove,
  defaultProjectId,
  onClose,
  onSaved,
}: TaskFormModalProps) {
  const [form, setForm] = useState<TaskInput>(emptyInput(defaultProjectId));
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Цонх нээгдэх бүрд засаж буй даалгаврын утгаар дүүргэнэ
  useEffect(() => {
    setForm(
      task
        ? {
            projectId: task.projectId,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            assignedTo: task.assignedTo,
            dueDate: task.dueDate,
          }
        : emptyInput(defaultProjectId)
    );
    setError(null);
  }, [task, defaultProjectId, isOpen]);

  const update = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.projectId) {
      setError("Төслийг сонгоно уу.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (!task) {
        await createTask(form);
      } else if (canEdit) {
        await updateTask(task.id, form);
      } else {
        // Гүйцэтгэгчийн эрхээр зөвхөн төлөв явуулна — бусдыг сервер няцаана
        await updateTask(task.id, { status: form.status });
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error("Даалгавар хадгалахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;

    setRemoving(true);
    setError(null);

    try {
      await deleteTask(task.id);
      onSaved();
      onClose();
    } catch (err) {
      console.error("Даалгавар устгахад алдаа гарлаа:", err);
      setError(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    } finally {
      setRemoving(false);
    }
  };

  const readOnly = !canEdit;
  const canSubmit = canEdit || (!!task && canMove);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg p-0">
      <form onSubmit={handleSubmit} className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {task
            ? canEdit
              ? "Даалгавар засах"
              : "Даалгавар"
            : "Ажлын даалгавар үүсгэх"}
        </h3>

        <div className="mt-5 grid gap-4">
          <div>
            <label htmlFor="task-project" className={labelClass}>
              Төсөл <span className="text-error-500">*</span>
            </label>
            <select
              id="task-project"
              value={form.projectId}
              onChange={(event) => update("projectId", event.target.value)}
              disabled={readOnly}
              className={fieldClass}
            >
              <option value="">Сонгоно уу</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {projectLabel(project)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="task-title" className={labelClass}>
              Даалгаврын нэр <span className="text-error-500">*</span>
            </label>
            <input
              id="task-title"
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="Жишээ нь: Хурлын танхим бэлтгэх"
              maxLength={120}
              disabled={readOnly}
              className={fieldClass}
              autoFocus={!task}
            />
          </div>

          <div>
            <label htmlFor="task-description" className={labelClass}>
              Тайлбар <span className="text-gray-400">(заавал биш)</span>
            </label>
            <textarea
              id="task-description"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              rows={3}
              maxLength={2000}
              disabled={readOnly}
              className={`${fieldClass} h-auto py-2.5`}
            />
          </div>

          <div>
            <label htmlFor="task-assignee" className={labelClass}>
              Гүйцэтгэгч
            </label>
            <select
              id="task-assignee"
              value={form.assignedTo ?? ""}
              onChange={(event) =>
                update("assignedTo", event.target.value || null)
              }
              disabled={readOnly}
              className={fieldClass}
            >
              <option value="">Хуваарилаагүй</option>
              {/* Засах эрхгүй үед жагсаалт хоосон ирдэг тул одоогийн
                  гүйцэтгэгчийг нэрээр нь харуулна */}
              {readOnly && task?.assignedTo && (
                <option value={task.assignedTo}>{task.assigneeName}</option>
              )}
              {people.map((person) => (
                <option key={person.uid} value={person.uid}>
                  {personName(person)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="task-status" className={labelClass}>
                Төлөв
              </label>
              <select
                id="task-status"
                value={form.status}
                onChange={(event) =>
                  update("status", event.target.value as TaskInput["status"])
                }
                disabled={!canEdit && !canMove}
                className={fieldClass}
              >
                {taskStatuses.map((status) => (
                  <option key={status} value={status}>
                    {taskStatusLabels[status]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-priority" className={labelClass}>
                Ач холбогдол
              </label>
              <select
                id="task-priority"
                value={form.priority}
                onChange={(event) =>
                  update("priority", event.target.value as TaskInput["priority"])
                }
                disabled={readOnly}
                className={fieldClass}
              >
                {taskPriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {taskPriorityLabels[priority]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="task-due" className={labelClass}>
              Дуусах огноо <span className="text-gray-400">(заавал биш)</span>
            </label>
            <input
              id="task-due"
              type="date"
              value={form.dueDate}
              onChange={(event) => update("dueDate", event.target.value)}
              disabled={readOnly}
              className={fieldClass}
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {task && canEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={removing || saving}
              className="mr-auto rounded-lg border border-gray-200 px-4 py-2.5 text-theme-sm font-medium text-error-500 transition-colors hover:bg-error-50 disabled:opacity-60 dark:border-white/10 dark:hover:bg-error-500/10"
            >
              {removing ? "Устгаж байна..." : "Устгах"}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            {canSubmit ? "Буцах" : "Хаах"}
          </button>

          {canSubmit && (
            <button
              type="submit"
              disabled={saving || removing}
              className="rounded-lg bg-accent-600 px-4 py-2.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Хадгалж байна..." : "Хадгалах"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
