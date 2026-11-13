"use client";

import React, { useEffect, useMemo, useState } from "react";
import { UserPlus, X } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { labelOf, aimags } from "@/data/profileOptions";
import {
  taskPriorities,
  taskPriorityLabels,
  taskStatusLabels,
  taskStatuses,
} from "@/data/taskOptions";
import { projectVisibleToAimag } from "@/lib/permissions";
import { buildProjectTree, pathLabel } from "@/lib/projectTree";
import {
  createTask,
  deleteTask,
  listPlanPeople,
  updateTask,
  type PlanPerson,
  type Project,
  type Task,
  type TaskInput,
} from "@/lib/tasks";

type TaskFormModalProps = {
  isOpen: boolean;
  /** null бол шинээр үүсгэнэ */
  task: Task | null;
  projects: Project[];
  /** Шинэ даалгаварт урьдчилж сонгогдох аймгууд (аймгийн хуудсанд тэр аймаг) */
  defaultAimags: string[];
  /** Харуул/админ эсэх — "Ерөнхий" (аймаггүй) даалгавар үүсгэж чадна */
  canManage: boolean;
  /** Бүх талбарыг засах эрхтэй эсэх */
  canEdit: boolean;
  /** Зөвхөн төлөвөө сольж чадах эсэх (хариуцагч, хамтрагч) */
  canMove: boolean;
  /** Устгах эрхтэй эсэх — үүсгэсэн хүн эсвэл Харуул/админ */
  canDelete: boolean;
  /** Шинээр үүсгэхэд урьдчилж сонгогдох тушаал */
  defaultProjectId: string;
  onClose: () => void;
  onSaved: () => void;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden focus:ring-3 focus:ring-accent-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";

const labelClass =
  "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

const chipClass = (active: boolean) =>
  `rounded-full border px-2.5 py-1 text-theme-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
    active
      ? "border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400"
      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
  }`;

const emptyInput = (projectId: string, aimagList: string[]): TaskInput => ({
  projectId,
  aimags: aimagList,
  title: "",
  description: "",
  status: "todo",
  priority: "normal",
  assignedTo: null,
  collaborators: [],
  dueDate: "",
});

/** Аймгуудын товч тайлбар — ижил нэртэй тушаал ялгагдана */
const aimagsLabel = (project: Project) =>
  project.aimags.length > 0
    ? project.aimags.map((a) => labelOf(aimags, a)).join(", ")
    : "Бүх аймаг";

/**
 * Ажлын даалгавар үүсгэх / засах цонх.
 *
 * Даалгаварт олон аймаг оролцож болно. Ерөнхий хариуцагч нэг, хамтрагч
 * олон. Эрхээс хамаарч гурван горимд ажиллана: оролцох аймгийн гишүүн (ба
 * Харуул/админ) бүхнийг засна, хариуцагч/хамтрагч зөвхөн төлөвөө сольно,
 * бусад нь зөвхөн харна.
 */
export default function TaskFormModal({
  isOpen,
  task,
  projects,
  defaultAimags,
  canManage,
  canEdit,
  canMove,
  canDelete,
  defaultProjectId,
  onClose,
  onSaved,
}: TaskFormModalProps) {
  const [form, setForm] = useState<TaskInput>(
    emptyInput(defaultProjectId, defaultAimags)
  );
  const [people, setPeople] = useState<PlanPerson[]>([]);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultAimagsKey = defaultAimags.join(",");

  // Цонх нээгдэх бүрд засаж буй даалгаврын утгаар дүүргэнэ
  useEffect(() => {
    setForm(
      task
        ? {
            projectId: task.projectId,
            aimags: task.aimags,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            assignedTo: task.assignedTo,
            collaborators: task.collaborators,
            dueDate: task.dueDate,
          }
        : emptyInput(
            defaultProjectId,
            defaultAimagsKey ? defaultAimagsKey.split(",") : []
          )
    );
    setError(null);
  }, [task, defaultProjectId, defaultAimagsKey, isOpen]);

  // Хариуцагч/хамтрагч болох хүмүүс — сонгосон аймгуудын гишүүд
  const aimagsKey = form.aimags.join(",");
  useEffect(() => {
    if (!isOpen || !canEdit) return;
    // Аймаггүй бол бүх хүн — зөвхөн Харуул/админд нээлттэй
    if (!aimagsKey && !canManage) return;

    let cancelled = false;
    listPlanPeople(aimagsKey ? aimagsKey.split(",") : [])
      .then((rows) => {
        if (!cancelled) setPeople(rows);
      })
      .catch((err) => console.error("Хүмүүсийг уншихад алдаа гарлаа:", err));

    return () => {
      cancelled = true;
    };
  }, [isOpen, canEdit, canManage, aimagsKey]);

  const update = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const tree = useMemo(() => buildProjectTree(projects), [projects]);
  const selectedProject = projects.find((p) => p.id === form.projectId);

  // Сонгосон тушаал харагдах аймгууд л сонголтод орно
  const aimagChoices = aimags.filter(
    (option) =>
      !selectedProject ||
      projectVisibleToAimag(selectedProject.aimags, option.value)
  );

  const toggleAimag = (aimag: string) =>
    update(
      "aimags",
      form.aimags.includes(aimag)
        ? form.aimags.filter((item) => item !== aimag)
        : [...form.aimags, aimag]
    );

  /** uid → нэр: жагсаалтад байхгүй (хуучин) хүмүүсийг даалгавраас нь авна */
  const nameOf = (uid: string) => {
    const person = people.find((item) => item.uid === uid);
    if (person) return person.name;
    if (task?.assignedTo === uid) return task.assigneeName || "Нэргүй";
    const index = task?.collaborators.indexOf(uid) ?? -1;
    return index >= 0 ? task?.collaboratorNames[index] ?? "Нэргүй" : "Нэргүй";
  };

  const partnerChoices = people.filter(
    (person) =>
      person.uid !== form.assignedTo && !form.collaborators.includes(person.uid)
  );

  const setLead = (uid: string | null) => {
    setForm((prev) => ({
      ...prev,
      assignedTo: uid,
      // Хариуцагч нь хамтрагчдын жагсаалтад давхардахгүй
      collaborators: prev.collaborators.filter((item) => item !== uid),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.projectId) {
      setError("Тушаалыг сонгоно уу.");
      return;
    }
    if (!task && !canManage && form.aimags.length === 0) {
      setError("Аймгаа сонгоно уу.");
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
        // Хариуцагч/хамтрагчийн эрхээр зөвхөн төлөв явуулна
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

        {selectedProject?.parentId && (
          <p className="mt-1 text-theme-xs text-gray-400">
            {pathLabel(tree, selectedProject.id)}
          </p>
        )}

        <div className="mt-5 grid gap-4">
          <div>
            <label htmlFor="task-project" className={labelClass}>
              Тушаал <span className="text-error-500">*</span>
            </label>
            <select
              id="task-project"
              value={form.projectId}
              onChange={(event) => update("projectId", event.target.value)}
              disabled={readOnly}
              className={fieldClass}
            >
              <option value="">Сонгоно уу</option>
              {/* Модны дарааллаар — дэд тушаал эхийнхээ доор догол мөртэй */}
              {tree.flat.map(({ project, depth }) => (
                <option key={project.id} value={project.id}>
                  {`${"  ".repeat(depth)}${depth > 0 ? "└ " : ""}${project.name} · ${aimagsLabel(project)}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className={labelClass}>
              Аймгууд
              {!canManage && <span className="text-error-500"> *</span>}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {canManage && (
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => update("aimags", [])}
                  className={chipClass(form.aimags.length === 0)}
                >
                  Ерөнхий (бүх аймагт)
                </button>
              )}
              {aimagChoices.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={readOnly}
                  onClick={() => toggleAimag(option.value)}
                  aria-pressed={form.aimags.includes(option.value)}
                  className={chipClass(form.aimags.includes(option.value))}
                >
                  {option.label}
                </button>
              ))}
              {/* Тушаал солигдсоноор сонголтоос гарсан аймаг харагдсаар байна */}
              {form.aimags
                .filter(
                  (aimag) => !aimagChoices.some((option) => option.value === aimag)
                )
                .map((aimag) => (
                  <button
                    key={aimag}
                    type="button"
                    disabled={readOnly}
                    onClick={() => toggleAimag(aimag)}
                    className={`${chipClass(true)} line-through`}
                    title="Энэ тушаалд харагдахгүй аймаг — дарж хасна"
                  >
                    {labelOf(aimags, aimag)}
                  </button>
                ))}
            </div>
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
              Ерөнхий хариуцагч
            </label>
            <select
              id="task-assignee"
              value={form.assignedTo ?? ""}
              onChange={(event) => setLead(event.target.value || null)}
              disabled={readOnly}
              className={fieldClass}
            >
              <option value="">Хуваарилаагүй</option>
              {form.assignedTo &&
                !people.some((person) => person.uid === form.assignedTo) && (
                  <option value={form.assignedTo}>{nameOf(form.assignedTo)}</option>
                )}
              {people.map((person) => (
                <option key={person.uid} value={person.uid}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className={labelClass}>Хамтрах</span>

            {form.collaborators.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {form.collaborators.map((uid) => (
                  <span
                    key={uid}
                    className="flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-2.5 pr-1 text-theme-xs text-gray-700 dark:bg-white/10 dark:text-gray-300"
                  >
                    {nameOf(uid)}
                    {!readOnly && (
                      <button
                        type="button"
                        aria-label={`${nameOf(uid)} хасах`}
                        onClick={() =>
                          update(
                            "collaborators",
                            form.collaborators.filter((item) => item !== uid)
                          )
                        }
                        className="flex h-4 w-4 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-white/15"
                      >
                        <X className="h-3 w-3" strokeWidth={2.5} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              readOnly && (
                <p className="text-theme-sm text-gray-400">Хамтрагчгүй</p>
              )
            )}

            {!readOnly && (
              <div className="relative">
                <UserPlus
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  strokeWidth={1.8}
                />
                <select
                  value=""
                  onChange={(event) => {
                    const uid = event.target.value;
                    if (uid) update("collaborators", [...form.collaborators, uid]);
                  }}
                  disabled={partnerChoices.length === 0}
                  aria-label="Хамтрагч нэмэх"
                  className={`${fieldClass} pl-10`}
                >
                  <option value="">
                    {partnerChoices.length === 0
                      ? form.aimags.length === 0 && !canManage
                        ? "Эхлээд аймгаа сонгоно уу"
                        : "Нэмэх хүн алга"
                      : "Хамтрагч нэмэх..."}
                  </option>
                  {partnerChoices.map((person) => (
                    <option key={person.uid} value={person.uid}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
          {task && canDelete && (
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
