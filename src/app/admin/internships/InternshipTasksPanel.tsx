"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import LayoutEditor from "./LayoutEditor";

type Task = {
  id: string;
  internship_id: string;
  position: number;
  title: string;
  summary: string | null;
};

type FileKind =
  | "tasks_pdf_path"
  | "certificate_template_path"
  | "appreciation_template_path";

type FileSlot = {
  kind: FileKind;
  label: string;
  hint: string;
  accept: string;
  allowed: string[];
  maxMb: number;
  folder: string;
};

type TaskForm = {
  title: string;
  summary: string;
  position: string;
};

type Props = {
  internshipId: string;
  tasksPdfPath: string | null;
  certificateTemplatePath: string | null;
  appreciationTemplatePath: string | null;
  onFilesChangedAction: () => void | Promise<void>;
};

const BUCKET = "internship-files";

const FILE_SLOTS: FileSlot[] = [
  {
    kind: "tasks_pdf_path",
    label: "Internship tasks PDF",
    hint: "One PDF with all tasks. Interns download it from their internship panel. PDF, up to 10 MB.",
    accept: "application/pdf",
    allowed: ["application/pdf"],
    maxMb: 10,
    folder: "tasks",
  },
  {
    kind: "certificate_template_path",
    label: "Internship certificate template",
    hint: "PNG only. The confirmed name and verification code are added when you issue it. Up to 5 MB.",
    accept: "image/png",
    allowed: ["image/png"],
    maxMb: 5,
    folder: "templates",
  },
  {
    kind: "appreciation_template_path",
    label: "Appreciation letter template",
    hint: "PNG only. The confirmed name, domain, and duration are written on it when the certificate is issued. Up to 5 MB.",
    accept: "image/png",
    allowed: ["image/png"],
    maxMb: 5,
    folder: "templates",
  },
];

const emptyTaskForm: TaskForm = {
  title: "",
  summary: "",
  position: "",
};

export default function InternshipTasksPanel({
  internshipId,
  tasksPdfPath,
  certificateTemplatePath,
  appreciationTemplatePath,
  onFilesChangedAction,
}: Props) {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [busySlot, setBusySlot] = useState<FileKind | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentPaths: Record<FileKind, string | null> = {
    tasks_pdf_path: tasksPdfPath,
    certificate_template_path: certificateTemplatePath,
    appreciation_template_path: appreciationTemplatePath,
  };

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);

    const { data, error: fetchError } = await supabase
      .from("internship_tasks")
      .select("*")
      .eq("internship_id", internshipId)
      .order("position", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setTasks([]);
    } else {
      setTasks((data ?? []) as Task[]);
    }

    setLoadingTasks(false);
  }, [supabase, internshipId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  function updateTaskField<K extends keyof TaskForm>(
    field: K,
    value: TaskForm[K]
  ) {
    setTaskForm((current) => ({ ...current, [field]: value }));
  }

  function resetTaskForm() {
    setEditingTaskId(null);
    setTaskForm(emptyTaskForm);
  }

  function startEditingTask(task: Task) {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      summary: task.summary ?? "",
      position: String(task.position),
    });
    setMessage("");
    setError("");
  }

  async function saveTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const title = taskForm.title.trim();

    if (!title) {
      setError("Please enter a task title.");
      return;
    }

    const nextPosition = tasks.length
      ? Math.max(...tasks.map((task) => task.position)) + 1
      : 1;

    const position =
      taskForm.position.trim() === ""
        ? nextPosition
        : Number(taskForm.position);

    if (!Number.isInteger(position) || position < 1) {
      setError("Task number must be a whole number, 1 or more.");
      return;
    }

    setSavingTask(true);

    const payload = {
      internship_id: internshipId,
      position,
      title,
      summary: taskForm.summary.trim() || null,
    };

    const result = editingTaskId
      ? await supabase
          .from("internship_tasks")
          .update(payload)
          .eq("id", editingTaskId)
          .select("id")
      : await supabase.from("internship_tasks").insert(payload).select("id");

    setSavingTask(false);

    if (result.error) {
      setError(
        result.error.code === "23505"
          ? "Another task already uses that task number. Choose a different number."
          : result.error.message
      );
      return;
    }

    if (!result.data?.length) {
      setError("The task was not saved. Check your database permissions.");
      return;
    }

    setMessage(editingTaskId ? "Task updated." : "Task added.");
    resetTaskForm();
    await loadTasks();
  }

  async function deleteTask(task: Task) {
    if (
      !window.confirm(
        `Delete "${task.title}"? Students' combined submissions are not affected.`
      )
    ) {
      return;
    }

    setDeletingTaskId(task.id);
    setMessage("");
    setError("");

    const { data, error: deleteError } = await supabase
      .from("internship_tasks")
      .delete()
      .eq("id", task.id)
      .select("id");

    setDeletingTaskId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (!data?.length) {
      setError("Could not delete the task. Check your database permissions.");
      return;
    }

    if (editingTaskId === task.id) resetTaskForm();

    setMessage("Task deleted.");
    await loadTasks();
  }

  async function uploadFile(slot: FileSlot, file: File) {
    setMessage("");
    setError("");

    if (!slot.allowed.includes(file.type)) {
      setError(`${slot.label}: please choose a valid file type.`);
      return;
    }

    if (file.size > slot.maxMb * 1024 * 1024) {
      setError(`${slot.label}: the file must be smaller than ${slot.maxMb} MB.`);
      return;
    }

    setBusySlot(slot.kind);

    const extension =
      file.name.split(".").pop()?.toLowerCase() ||
      (file.type === "application/pdf" ? "pdf" : "png");

    const path = `${slot.folder}/${internshipId}/${slot.kind}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      setBusySlot(null);
      setError(`Upload failed: ${uploadError.message}`);
      return;
    }

    const { data, error: updateError } = await supabase
      .from("internships")
      .update({ [slot.kind]: path })
      .eq("id", internshipId)
      .select("id");

    if (updateError || !data?.length) {
      await supabase.storage.from(BUCKET).remove([path]);
      setBusySlot(null);
      setError(
        updateError?.message ??
          "The file was uploaded but could not be linked. Check your database permissions."
      );
      return;
    }

    // Replace: remove the previous file only after the new one is linked.
    const oldPath = currentPaths[slot.kind];
    if (oldPath) {
      await supabase.storage.from(BUCKET).remove([oldPath]);
    }

    setBusySlot(null);
    setMessage(`${slot.label} saved.`);
    await onFilesChangedAction();
  }

  async function removeFile(slot: FileSlot) {
    const oldPath = currentPaths[slot.kind];
    if (!oldPath) return;

    if (!window.confirm(`Remove the ${slot.label.toLowerCase()}?`)) return;

    setMessage("");
    setError("");
    setBusySlot(slot.kind);

    const { data, error: updateError } = await supabase
      .from("internships")
      .update({ [slot.kind]: null })
      .eq("id", internshipId)
      .select("id");

    if (updateError || !data?.length) {
      setBusySlot(null);
      setError(updateError?.message ?? "Could not remove the file.");
      return;
    }

    await supabase.storage.from(BUCKET).remove([oldPath]);

    setBusySlot(null);
    setMessage(`${slot.label} removed.`);
    await onFilesChangedAction();
  }

  async function viewFile(slot: FileSlot) {
    const path = currentPaths[slot.kind];
    if (!path) return;

    setError("");

    const { data, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 600);

    if (signError || !data?.signedUrl) {
      setError(signError?.message ?? "Could not open the file.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mt-6 space-y-8 border-t border-current/10 pt-6">
      {message && (
        <p
          role="status"
          className="rounded-lg border border-green-600/30 p-3 text-sm"
        >
          {message}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="break-words rounded-lg border border-red-500/40 p-3 text-sm"
        >
          {error}
        </p>
      )}

      <section aria-label="Internship files">
        <h4 className="text-base font-semibold">Files</h4>
        <p className="mt-1 text-sm text-muted">
          These files are private. Interns receive them only through the site.
        </p>

        <div className="mt-4 space-y-4">
          {FILE_SLOTS.map((slot) => {
            const hasFile = Boolean(currentPaths[slot.kind]);
            const busy = busySlot === slot.kind;

            return (
              <div
                key={slot.kind}
                className="rounded-lg border border-current/10 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{slot.label}</p>
                    <p className="mt-1 text-xs text-muted">{slot.hint}</p>
                    <p className="mt-2 text-xs">
                      {hasFile ? "Uploaded" : "Not uploaded yet"}
                    </p>
                  </div>

                  {hasFile && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void viewFile(slot)}
                        className="rounded-lg border border-current/20 px-3 py-1.5 text-xs hover:bg-current/5"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeFile(slot)}
                        disabled={busy}
                        className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-600 hover:bg-red-500/5 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <label className="mt-3 block text-xs font-medium">
                  {hasFile ? "Replace file" : "Upload file"}
                  <input
                    type="file"
                    accept={slot.accept}
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void uploadFile(slot, file);
                    }}
                    className="mt-1 block w-full text-sm font-normal disabled:opacity-50"
                  />
                </label>

                {busy && (
                  <p className="mt-2 text-xs text-muted">Working...</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label="Internship tasks">
        <h4 className="text-base font-semibold">Tasks</h4>
        <p className="mt-1 text-sm text-muted">
          Every task shares the internship end date. Students complete all tasks and submit them together in one ZIP.
        </p>

        <form onSubmit={saveTask} className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_9rem]">
            <label className="block text-sm font-medium">
              Task title *
              <input
                required
                maxLength={200}
                value={taskForm.title}
                onChange={(e) => updateTaskField("title", e.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
                placeholder="Build a login and signup system"
              />
            </label>

            <label className="block text-sm font-medium">
              Task number
              <input
                type="number"
                min={1}
                step={1}
                value={taskForm.position}
                onChange={(e) => updateTaskField("position", e.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
                placeholder="Auto"
              />
            </label>
          </div>

          <label className="block text-sm font-medium">
            Short summary
            <textarea
              rows={3}
              value={taskForm.summary}
              onChange={(e) => updateTaskField("summary", e.target.value)}
              className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
              placeholder="One or two lines shown next to the task on the intern's dashboard."
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={savingTask}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingTask
                ? "Saving..."
                : editingTaskId
                  ? "Save task"
                  : "Add task"}
            </button>

            {editingTaskId && (
              <button
                type="button"
                onClick={resetTaskForm}
                className="rounded-lg border border-current/20 px-4 py-2.5 text-sm hover:bg-current/5"
              >
                Cancel editing
              </button>
            )}
          </div>
        </form>

        <div className="mt-6">
          {loadingTasks ? (
            <p className="text-sm text-muted">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-current/20 p-4 text-sm text-muted">
              No tasks yet. Add the first task above.
            </p>
          ) : (
            <ol className="space-y-3">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-col justify-between gap-3 rounded-lg border border-current/10 p-4 sm:flex-row"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      Task {task.position}: {task.title}
                    </p>
                    {task.summary && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
                        {task.summary}
                      </p>
                    )}

                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEditingTask(task)}
                      className="rounded-lg border border-current/20 px-3 py-1.5 text-xs hover:bg-current/5"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteTask(task)}
                      disabled={deletingTaskId === task.id}
                      className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-600 hover:bg-red-500/5 disabled:opacity-50"
                    >
                      {deletingTaskId === task.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <LayoutEditor internshipId={internshipId} />
    </div>
  );
}
