
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Course = {
  id: string;
  title: string;
  slug: string;
  published: boolean | null;
};

type Module = {
  id: string;
  course_id: string;
  position: number;
  title: string;
  youtube_id: string | null;
  notes_md: string | null;
};

type ModuleForm = {
  course_id: string;
  position: string;
  title: string;
  youtube_url: string;
  notes_md: string;
};

const emptyForm: ModuleForm = {
  course_id: "",
  position: "1",
  title: "",
  youtube_url: "",
  notes_md: "",
};

const inputClass =
  "mt-2 w-full rounded-xl border border-current/15 bg-transparent px-3.5 py-3 outline-none transition focus:border-current/40";
const labelClass = "block text-sm font-medium";

function getYouTubeId(value: string): string | null {
  const input = value.trim();
  if (!input) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      const fromQuery = url.searchParams.get("v");
      const parts = url.pathname.split("/").filter(Boolean);
      const id =
        fromQuery ||
        (["embed", "shorts", "live"].includes(parts[0] ?? "")
          ? parts[1]
          : null);

      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
  } catch {
    return null;
  }

  return null;
}

export default function AdminModulesPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [form, setForm] = useState<ModuleForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingModules, setLoadingModules] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadCourses = useCallback(async () => {
    setLoadingCourses(true);

    const { data, error: fetchError } = await supabase
      .from("courses")
      .select("id,title,slug,published")
      .order("title", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setCourses([]);
    } else {
      const rows = (data ?? []) as Course[];
      setCourses(rows);

      setSelectedCourseId((current) => {
        if (current && rows.some((course) => course.id === current)) {
          return current;
        }
        return rows[0]?.id ?? "";
      });
    }

    setLoadingCourses(false);
  }, [supabase]);

  const loadModules = useCallback(async () => {
    if (!selectedCourseId) {
      setModules([]);
      setLoadingModules(false);
      return;
    }

    setLoadingModules(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("modules")
      .select("id,course_id,position,title,youtube_id,notes_md")
      .eq("course_id", selectedCourseId)
      .order("position", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setModules([]);
    } else {
      setModules((data ?? []) as Module[]);
    }

    setLoadingModules(false);
  }, [selectedCourseId, supabase]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    void loadModules();
  }, [loadModules]);

  useEffect(() => {
    if (!editingId) {
      setForm((current) => ({
        ...current,
        course_id: selectedCourseId,
      }));
    }
  }, [selectedCourseId, editingId]);

  function updateField<K extends keyof ModuleForm>(
    field: K,
    value: ModuleForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function getNextPosition() {
    const usedPositions = new Set(modules.map((module) => module.position));
    let position = 1;

    while (usedPositions.has(position)) {
      position++;
    }

    return position;
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      course_id: selectedCourseId,
      position: String(getNextPosition()),
    });
    setMessage("");
    setError("");
  }

  function startEditing(module: Module) {
    setEditingId(module.id);
    setForm({
      course_id: module.course_id,
      position: String(module.position),
      title: module.title,
      youtube_url: module.youtube_id
        ? `https://www.youtube.com/watch?v=${module.youtube_id}`
        : "",
      notes_md: module.notes_md ?? "",
    });

    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const position = Number(form.position);
    const youtubeInput = form.youtube_url.trim();
    const youtubeId = getYouTubeId(youtubeInput);

    if (!form.course_id) {
      setError("Choose a course first.");
      setSaving(false);
      return;
    }

    if (!Number.isInteger(position) || position < 1) {
      setError("Module position must be a whole number starting at 1.");
      setSaving(false);
      return;
    }

    if (!form.title.trim()) {
      setError("Module title is required.");
      setSaving(false);
      return;
    }

    if (youtubeInput && !youtubeId) {
      setError("Enter a valid YouTube video URL or an 11-character video ID.");
      setSaving(false);
      return;
    }

    const payload = {
      course_id: form.course_id,
      position,
      title: form.title.trim(),
      youtube_id: youtubeId,
      notes_md: form.notes_md.trim() || null,
    };

    try {
      const result = editingId
        ? await supabase
        .from("modules")
        .update(payload)
        .eq("id", editingId)
        .select("id, title, youtube_id")
        : await supabase.from("modules").insert(payload);

      if (result.error) {
        if (result.error.code === "23505") {
          setError(
            "That module position is already used in this course. Choose a different position.",
          );
        } else {
          setError(result.error.message);
        }
        return;
      }

      const wasEditing = Boolean(editingId);
      const savedCourseId = form.course_id;

      setSelectedCourseId(savedCourseId);
      setEditingId(null);
      setForm({
        ...emptyForm,
        course_id: savedCourseId,
        position: String(
          wasEditing ? getNextPosition() : Math.max(position + 1, getNextPosition()),
        ),
      });
      setMessage(
        wasEditing
          ? "Module updated successfully."
          : "Module added successfully.",
      );

      await loadModules();
    } catch {
      setError("Something went wrong while saving the module.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteModule(module: Module) {
    const confirmed = window.confirm(
      `Delete module "${module.title}"? Any assignments or progress linked to this module may also be deleted because of database relationships.`,
    );

    if (!confirmed) return;

    setDeletingId(module.id);
    setMessage("");
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("modules")
        .delete()
        .eq("id", module.id);

      if (deleteError) {
        setError(deleteError.message);
        return;
      }

      if (editingId === module.id) {
        setEditingId(null);
        setForm({
          ...emptyForm,
          course_id: selectedCourseId,
          position: String(getNextPosition()),
        });
      }

      setMessage("Module deleted successfully.");
      await loadModules();
    } catch {
      setError("Could not delete the module. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const selectedCourse = courses.find(
    (course) => course.id === selectedCourseId,
  );

  return (
    <main className="container-page py-10 md:py-14">
      <header className="mb-9 md:mb-12">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          BioCode Innovators · Research Wing
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Module management
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Manage module titles, YouTube lessons, notes, and learning resources.
          Assignments are managed separately.
        </p>
      </header>

      <section className="mb-10 rounded-2xl border border-current/10 p-5 md:p-7">
        <label className={labelClass}>
          Select course
          <select
            value={selectedCourseId}
            onChange={(event) => {
              const courseId = event.target.value;
              setSelectedCourseId(courseId);
              setEditingId(null);
              setForm({ ...emptyForm, course_id: courseId });
              setMessage("");
              setError("");
            }}
            className={inputClass}
            disabled={loadingCourses || courses.length === 0}
          >
            {courses.length === 0 && (
              <option value="">No courses available</option>
            )}
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title} {course.published ? "(Published)" : "(Draft)"}
              </option>
            ))}
          </select>
        </label>

        {selectedCourse && (
          <p className="mt-2 text-xs text-muted">
            Course URL slug: {selectedCourse.slug}
          </p>
        )}
      </section>

      <section className="mb-12 rounded-2xl border border-current/10 p-5 md:p-7">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              {editingId ? "Edit module" : "Add a module"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Position determines the module order within the selected course.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-current/15 px-4 py-2.5 text-sm hover:bg-current/5"
            >
              Cancel editing
            </button>
          )}
        </div>

        {message && (
          <p
            role="status"
            className="mb-5 rounded-xl border border-green-600/30 p-3 text-sm"
          >
            {message}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-red-500/40 p-3 text-sm"
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <label className={labelClass}>
              Module title *
              <input
                required
                maxLength={200}
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                className={inputClass}
                placeholder="Module 1: Introduction"
              />
            </label>

            <label className={labelClass}>
              Module position *
              <input
                required
                type="number"
                min="1"
                step="1"
                value={form.position}
                onChange={(event) =>
                  updateField("position", event.target.value)
                }
                className={inputClass}
              />
            </label>

            <label className={`${labelClass} md:col-span-2`}>
              YouTube session URL or video ID
              <input
                value={form.youtube_url}
                onChange={(event) =>
                  updateField("youtube_url", event.target.value)
                }
                className={inputClass}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <span className="mt-1 block text-xs text-muted">
                The video ID is saved to the database. Leave blank if the
                session is not ready.
              </span>
            </label>

            <label className={`${labelClass} md:col-span-2`}>
              Notes and learning resources
              <textarea
                rows={6}
                value={form.notes_md}
                onChange={(event) =>
                  updateField("notes_md", event.target.value)
                }
                className={inputClass}
                placeholder="Add notes, resource links, or Markdown content."
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-current/10 pt-6">
            <button
              type="submit"
              disabled={saving || !selectedCourseId}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save changes"
                  : "Add module"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-current/15 px-5 py-3 text-sm hover:bg-current/5"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section>
        <div className="mb-5">
          <h2 className="text-2xl font-semibold">
            Modules {selectedCourse ? `for ${selectedCourse.title}` : ""}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {modules.length} {modules.length === 1 ? "module" : "modules"} saved
          </p>
        </div>

        {loadingCourses || loadingModules ? (
          <p className="py-10 text-muted">Loading modules...</p>
        ) : courses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-current/20 p-8 text-center">
            <p className="font-medium">No courses available yet.</p>
            <p className="mt-2 text-sm text-muted">
              Create a course first in Admin → Courses.
            </p>
          </div>
        ) : modules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-current/20 p-8 text-center">
            <p className="font-medium">No modules for this course yet.</p>
            <p className="mt-2 text-sm text-muted">
              Add the first module using the form above.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {modules.map((module) => (
              <article
                key={module.id}
                className="rounded-2xl border border-current/10 p-5 md:p-6"
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Module {module.position}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">
                      {module.title}
                    </h3>

                    {module.youtube_id ? (
                      <a
                        href={`https://www.youtube.com/watch?v=${module.youtube_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-block break-all text-sm underline underline-offset-4"
                      >
                        Open YouTube session
                      </a>
                    ) : (
                      <p className="mt-3 text-sm text-muted">
                        No YouTube session added.
                      </p>
                    )}

                    {module.notes_md && (
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted">
                        {module.notes_md}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
                    <button
                      type="button"
                      onClick={() => startEditing(module)}
                      className="rounded-xl border border-current/15 px-4 py-2.5 text-sm hover:bg-current/5"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => void deleteModule(module)}
                      disabled={deletingId === module.id}
                      className="rounded-xl border border-red-500/40 px-4 py-2.5 text-sm text-red-600 hover:bg-red-500/5 disabled:opacity-50"
                    >
                      {deletingId === module.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
