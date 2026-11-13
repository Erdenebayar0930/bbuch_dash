"use client";

import React, { useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { aimags } from "@/data/profileOptions";
import {
  createProject,
  deleteProject,
  updateProject,
  type Project,
} from "@/lib/tasks";

type ProjectManagerModalProps = {
  isOpen: boolean;
  projects: Project[];
  onClose: () => void;
  /** Аль нэг өөрчлөлт хийгдсэн — жагсаалтыг дахин татна */
  onChanged: () => void;
};

const fieldClass =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:outline-hidden dark:border-white/10 dark:bg-white/[0.03] dark:text-white/90";

type Draft = { name: string; aimags: string[] };

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value) => b.includes(value));

/** Аймгийн олон сонголт — юу ч сонгоогүй бол "Бүх аймаг" */
function AimagPicker({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (aimag: string) =>
    onChange(
      value.includes(aimag)
        ? value.filter((item) => item !== aimag)
        : [...value, aimag]
    );

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-theme-xs font-medium transition-colors disabled:opacity-60 ${
      active
        ? "border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400"
        : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
    }`;

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([])}
        className={chip(value.length === 0)}
      >
        Бүх аймаг
      </button>
      {aimags.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => toggle(option.value)}
          aria-pressed={value.includes(option.value)}
          className={chip(value.includes(option.value))}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Төслүүдийг удирдах цонх — Харуулын аймаг ба админ.
 *
 * Төсөл бүрт ямар аймгуудад харагдахыг сонгоно (сонгоогүй = бүх аймагт).
 * Тухайн аймгуудын гишүүд төсөл дотор өөрсдийн даалгаврыг үүсгэнэ.
 */
export default function ProjectManagerModal({
  isOpen,
  projects,
  onClose,
  onChanged,
}: ProjectManagerModalProps) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Жагсаалт шинэчлэгдэх бүрд мөрийн утгуудыг эх өгөгдлөөр тэнцүүлнэ
  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        projects.map((project) => [
          project.id,
          { name: project.name, aimags: project.aimags },
        ])
      )
    );
    setError(null);
  }, [projects]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);

    try {
      await action();
      onChanged();
    } catch (err) {
      console.error("Төслийн үйлдэл амжилтгүй:", err);
      setError(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusy(null);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    await run("create", async () => {
      await createProject({ name: name.trim(), aimags: picked, description: "" });
      setName("");
      setPicked([]);
    });
  };

  const handleSave = (project: Project) => {
    const draft = drafts[project.id];
    if (!draft) return;

    return run(project.id, () =>
      updateProject(project.id, {
        name: draft.name.trim(),
        aimags: draft.aimags,
      })
    );
  };

  const handleDelete = (project: Project) => {
    const warning =
      project.taskCount > 0
        ? `"${project.name}" төслийг устгах уу? Доторх ${project.taskCount} даалгавар хамт устана.`
        : `"${project.name}" төслийг устгах уу?`;

    if (!window.confirm(warning)) return;

    return run(project.id, () => deleteProject(project.id));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl p-0">
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Төслүүд
        </h3>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Төсөл үүсгээд ямар аймгуудад харагдахыг сонгоно. Сонгосон аймгуудын
          гишүүд төсөл дотор өөрсдийн даалгаврыг үүсгэнэ.
        </p>

        {/* Шинэ төсөл */}
        <form
          onSubmit={handleCreate}
          className="mt-5 flex flex-col gap-2.5 rounded-lg border border-gray-200 p-3 dark:border-white/10"
        >
          <div className="flex flex-wrap gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Төслийн нэр"
              maxLength={120}
              className={`${fieldClass} min-w-[180px] flex-1`}
            />
            <button
              type="submit"
              disabled={busy !== null || !name.trim()}
              className="flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-3.5 text-theme-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "create" ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              ) : (
                <Plus className="h-4 w-4" strokeWidth={2.2} />
              )}
              Нэмэх
            </button>
          </div>
          <div>
            <p className="mb-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
              Харагдах аймгууд
            </p>
            <AimagPicker value={picked} onChange={setPicked} />
          </div>
        </form>

        {error && (
          <p className="mt-4 rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        )}

        {/* Одоо байгаа төслүүд */}
        <div className="mt-5 flex flex-col gap-2">
          {projects.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-theme-sm text-gray-400 dark:border-white/10">
              Төсөл үүсгээгүй байна.
            </p>
          )}

          {projects.map((project) => {
            const draft = drafts[project.id] ?? {
              name: project.name,
              aimags: project.aimags,
            };
            const dirty =
              draft.name.trim() !== project.name ||
              !sameSet(draft.aimags, project.aimags);

            return (
              <div
                key={project.id}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 p-2.5 dark:border-white/10"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [project.id]: { ...draft, name: event.target.value },
                      }))
                    }
                    aria-label="Төслийн нэр"
                    maxLength={120}
                    className={`${fieldClass} min-w-[160px] flex-1`}
                  />

                  <span className="text-theme-xs text-gray-400">
                    {project.openCount}/{project.taskCount} ажил
                  </span>

                  <button
                    type="button"
                    onClick={() => handleSave(project)}
                    disabled={!dirty || busy !== null}
                    aria-label="Хадгалах"
                    title="Хадгалах"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-success-600 transition-colors hover:bg-success-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-success-500/10"
                  >
                    <Check className="h-4 w-4" strokeWidth={2} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(project)}
                    disabled={busy !== null}
                    aria-label="Устгах"
                    title="Устгах"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-error-500 transition-colors hover:bg-error-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-error-500/10"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>

                <AimagPicker
                  value={draft.aimags}
                  disabled={busy !== null}
                  onChange={(next) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [project.id]: { ...draft, aimags: next },
                    }))
                  }
                />
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300"
          >
            Хаах
          </button>
        </div>
      </div>
    </Modal>
  );
}
