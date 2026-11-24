
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Course = {
  id: string;
  title: string;
  slug: string;
};

type Module = {
  id: string;
  course_id: string;
  position: number;
  title: string;
};

type Assignment = {
  id: string;
  module_id: string;
  kind: "quiz" | "written" | "upload" | "watch";
  prompt: string | null;
  config: Record<string, unknown> | null;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm";
const buttonClass =
  "rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-100";

function configString(
  config: Record<string, unknown> | null,
  key: string
): string {
  const value = config?.[key];
  return typeof value === "string" ? value : "";
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function AdminAssignmentsPage() {
  const [supabase] = useState(() => createBrowserSupabase());

  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [courseId, setCourseId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Assignment["kind"]>("upload");
  const [prompt, setPrompt] = useState("");
  const [deadline, setDeadline] = useState("");
  const [existingFilePath, setExistingFilePath] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadCourses = useCallback(async () => {
    const { data, error } = await supabase
      .from("courses")
      .select("id,title,slug")
      .order("title");

    if (error) {
      setMessage(`Could not load courses: ${error.message}`);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Course[];
    setCourses(rows);
    setCourseId((current) =>
      rows.some((course) => course.id === current)
        ? current
        : rows[0]?.id ?? ""
    );
    setLoading(false);
  }, [supabase]);

  const loadModules = useCallback(async () => {
    if (!courseId) {
      setModules([]);
      setModuleId("");
      setAssignments([]);
      return;
    }

    const { data, error } = await supabase
      .from("modules")
      .select("id,course_id,position,title")
      .eq("course_id", courseId)
      .order("position");

    if (error) {
      setMessage(`Could not load modules: ${error.message}`);
      return;
    }

    const rows = (data ?? []) as Module[];
    setModules(rows);
    setModuleId((current) =>
      rows.some((module) => module.id === current)
        ? current
        : rows[0]?.id ?? ""
    );
  }, [courseId, supabase]);

  const loadAssignments = useCallback(async () => {
    if (!moduleId) {
      setAssignments([]);
      return;
    }

    const { data, error } = await supabase
      .from("assignments")
      .select("id,module_id,kind,prompt,config")
      .eq("module_id", moduleId)
      .order("id");

    if (error) {
      setMessage(`Could not load assignments: ${error.message}`);
      return;
    }

    setAssignments((data ?? []) as Assignment[]);
  }, [moduleId, supabase]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    void loadModules();
  }, [loadModules]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setKind("upload");
    setPrompt("");
    setDeadline("");
    setExistingFilePath("");
    setSelectedFile(null);
  }

  function editAssignment(assignment: Assignment) {
    const config = assignment.config ?? {};

    setEditingId(assignment.id);
    setTitle(configString(config, "title"));
    setKind(assignment.kind);
    setPrompt(assignment.prompt ?? "");
    setDeadline(configString(config, "deadline"));
    setExistingFilePath(configString(config, "file_path"));
    setSelectedFile(null);
    setMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!moduleId) {
      setMessage("Select a module first.");
      return;
    }

    if (!title.trim()) {
      setMessage("Enter an assignment title.");
      return;
    }

    if (!prompt.trim()) {
      setMessage("Enter the assignment instructions.");
      return;
    }

    if (selectedFile && selectedFile.size > 50 * 1024 * 1024) {
      setMessage("The file must be 50 MB or smaller.");
      return;
    }

    setSaving(true);

    try {
      const previousConfig =
        editingId
          ? assignments.find((item) => item.id === editingId)?.config ?? {}
          : {};

      const initialConfig = {
        ...previousConfig,
        title: title.trim(),
        deadline: deadline || "",
        file_path: existingFilePath || "",
        file_name: configString(previousConfig, "file_name"),
      };

      let assignmentId = editingId;

      if (assignmentId) {
        const { error } = await supabase
          .from("assignments")
          .update({
            module_id: moduleId,
            kind,
            prompt: prompt.trim(),
            config: initialConfig,
          })
          .eq("id", assignmentId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("assignments")
          .insert({
            module_id: moduleId,
            kind,
            prompt: prompt.trim(),
            config: initialConfig,
          })
          .select("id")
          .single();

        if (error) throw error;
        assignmentId = data.id;
      }

      if (!assignmentId) {
        throw new Error("Could not determine the assignment ID.");
      }

      let nextConfig = { ...initialConfig };

      if (selectedFile) {
        const filePath =
          `problems/${assignmentId}/${Date.now()}-${safeFileName(selectedFile.name)}`;

        const { error: uploadError } = await supabase.storage
          .from("course-assignments")
          .upload(filePath, selectedFile, {
            upsert: false,
          });

        if (uploadError) throw uploadError;

        nextConfig = {
          ...nextConfig,
          file_path: filePath,
          file_name: selectedFile.name,
        };

        const { error: updateError } = await supabase
          .from("assignments")
          .update({ config: nextConfig })
          .eq("id", assignmentId);

        if (updateError) {
          throw new Error(
            `The file uploaded, but its path could not be saved. File path: ${filePath}. ${updateError.message}`
          );
        }
      }

      setMessage(
        editingId ? "Assignment updated successfully." : "Assignment created successfully."
      );
      resetForm();
      await loadAssignments();
    } catch (error) {
      setMessage(
        `Save failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      await loadAssignments();
    } finally {
      setSaving(false);
    }
  }

  async function deleteAssignment(assignment: Assignment) {
    if (!window.confirm("Delete this assignment? This cannot be undone.")) {
      return;
    }

    setMessage("");

    const config = assignment.config ?? {};
    const filePath = configString(config, "file_path");

    if (filePath) {
      const { error: storageError } = await supabase.storage
        .from("course-assignments")
        .remove([filePath]);

      if (storageError) {
        setMessage(
          `Could not delete the attached file: ${storageError.message}. The assignment was not deleted.`
        );
        return;
      }
    }

    const { error } = await supabase
      .from("assignments")
      .delete()
      .eq("id", assignment.id);

    if (error) {
      setMessage(`Delete failed: ${error.message}`);
      return;
    }

    if (editingId === assignment.id) resetForm();

    setMessage("Assignment deleted.");
    await loadAssignments();
  }

  async function openAssignmentFile(filePath: string) {
    const { data, error } = await supabase.storage
      .from("course-assignments")
      .createSignedUrl(filePath, 60);

    if (error) {
      setMessage(`Could not open file: ${error.message}`);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="container-page space-y-8 py-10">
      <header className="space-y-2">
        <p className="text-sm text-muted">
          BioCode Innovators · Research Wing
        </p>
        <h1 className="text-3xl font-semibold">Assignment management</h1>
        <p className="text-muted">
          Add one assignment for each module. Students submit their work for
          grading and verification before progressing to the next module.
        </p>
      </header>

      {message && (
        <div
          role="status"
          className="rounded-lg border border-gray-300 p-3 text-sm"
        >
          {message}
        </div>
      )}

      {loading ? (
        <p>Loading courses...</p>
      ) : courses.length === 0 ? (
        <p>No courses found. Create a course first.</p>
      ) : (
        <>
          <section className="space-y-4 rounded-xl border border-gray-200 p-5">
            <h2 className="text-xl font-semibold">Choose a module</h2>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Course</span>
              <select
                className={inputClass}
                value={courseId}
                onChange={(event) => {
                  setCourseId(event.target.value);
                  resetForm();
                  setMessage("");
                }}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} ({course.slug})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Module</span>
              <select
                className={inputClass}
                value={moduleId}
                onChange={(event) => {
                  setModuleId(event.target.value);
                  resetForm();
                  setMessage("");
                }}
                disabled={modules.length === 0}
              >
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    Module {module.position}: {module.title}
                  </option>
                ))}
              </select>
            </label>

            {modules.length === 0 && (
              <p className="text-sm text-muted">
                This course has no modules yet. Add a module first.
              </p>
            )}
          </section>

          {modules.length > 0 && (
            <>
              <section className="space-y-5 rounded-xl border border-gray-200 p-5">
                <h2 className="text-xl font-semibold">
                  {editingId ? "Edit assignment" : "Add an assignment"}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium">Assignment title</span>
                    <input
                      className={inputClass}
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="e.g. Sequence Alignment Exercise"
                      required
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium">Instructions</span>
                    <textarea
                      className={inputClass}
                      rows={5}
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder="Explain what the student must complete..."
                      required
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium">Submission deadline</span>
                    <input
                      className={inputClass}
                      type="datetime-local"
                      value={deadline}
                      onChange={(event) => setDeadline(event.target.value)}
                    />
                    <span className="text-xs text-muted">
                      Leave blank if there is no deadline.
                    </span>
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium">Assignment file</span>
                    <input
                      className={inputClass}
                      type="file"
                      onChange={(event) =>
                        setSelectedFile(event.target.files?.[0] ?? null)
                      }
                    />
                    <span className="block text-xs text-muted">
                      Any file type, up to 50 MB. Leave empty to keep the
                      existing file.
                    </span>
                  </label>

                  {existingFilePath && (
                    <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                      <p className="text-sm">
                        Current file:{" "}
                        {configString(
                          assignments.find((item) => item.id === editingId)?.config ?? {},
                          "file_name"
                        ) || existingFilePath.split("/").pop()}
                      </p>
                      <button
                        type="button"
                        className={buttonClass}
                        onClick={() => void openAssignmentFile(existingFilePath)}
                      >
                        Open current file
                      </button>
                    </div>
                  )}

                  <label className="block space-y-2">
                    <span className="text-sm font-medium">Assignment type</span>
                    <select
                      className={inputClass}
                      value={kind}
                      onChange={(event) =>
                        setKind(event.target.value as Assignment["kind"])
                      }
                    >
                      <option value="upload">File submission</option>
                      <option value="written">Written answer</option>
                      <option value="quiz">Quiz / MCQ</option>
                      <option value="watch">Watch lesson</option>
                    </select>
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className={buttonClass}
                    >
                      {saving
                        ? "Saving..."
                        : editingId
                          ? "Save changes"
                          : "Add assignment"}
                    </button>

                    {editingId && (
                      <button
                        type="button"
                        className={buttonClass}
                        onClick={resetForm}
                      >
                        Cancel edit
                      </button>
                    )}
                  </div>
                </form>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-semibold">
                  Assignments ({assignments.length})
                </h2>

                {assignments.length === 0 ? (
                  <p className="text-muted">
                    No assignments have been added to this module.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {assignments.map((assignment) => {
                      const config = assignment.config ?? {};
                      const filePath = configString(config, "file_path");
                      const fileName = configString(config, "file_name");

                      return (
                        <article
                          key={assignment.id}
                          className="space-y-3 rounded-xl border border-gray-200 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="font-semibold">
                                {configString(config, "title") || "Untitled assignment"}
                              </p>
                              <p className="text-sm text-muted">
                                {assignment.prompt || "No instructions added."}
                              </p>
                              <p className="text-xs text-muted">
                                Type: {assignment.kind}
                                {configString(config, "deadline")
                                  ? ` · Deadline: ${configString(config, "deadline")}`
                                  : ""}
                              </p>
                              {filePath && (
                                <p className="text-xs text-muted">
                                  Attached file: {fileName || filePath.split("/").pop()}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {filePath && (
                                <button
                                  type="button"
                                  className={buttonClass}
                                  onClick={() => void openAssignmentFile(filePath)}
                                >
                                  Open file
                                </button>
                              )}
                              <button
                                type="button"
                                className={buttonClass}
                                onClick={() => editAssignment(assignment)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className={buttonClass}
                                onClick={() => void deleteAssignment(assignment)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
