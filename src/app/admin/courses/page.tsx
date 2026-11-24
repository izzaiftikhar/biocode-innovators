
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
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  learning_outcomes: string[] | null;
  instructor_name: string | null;
  instructor_bio: string | null;
  requirements: string | null;
  certificate_criteria: string | null;
  thumbnail_url: string | null;
  price: number | null;
  level: string | null;
  duration: string | null;
  delivery: string | null;
  is_free: boolean | null;
  published: boolean | null;
  module_count: number;
  created_at: string | null;
};

type CourseForm = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  learning_outcomes: string;
  instructor_name: string;
  instructor_bio: string;
  requirements: string;
  certificate_criteria: string;
  thumbnail_url: string;
  price: string;
  level: string;
  duration: string;
  delivery: string;
  module_count: string;
  is_free: boolean;
  published: boolean;
};

const BUCKET = "research-journal-assets";

const emptyForm: CourseForm = {
  slug: "",
  title: "",
  summary: "",
  description: "",
  learning_outcomes: "",
  instructor_name: "",
  instructor_bio: "",
  requirements: "",
  certificate_criteria: "",
  thumbnail_url: "",
  price: "",
  level: "",
  duration: "",
  delivery: "",
  module_count: "1",
  is_free: true,
  published: false,
};

const inputClass =
  "mt-2 w-full rounded-xl border border-current/15 bg-transparent px-3.5 py-3 font-normal outline-none transition focus:border-current/40";
const labelClass = "block text-sm font-medium";
const sectionClass = "rounded-2xl border border-current/10 p-5 md:p-7";

function validateImage(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Please select a JPG, PNG, or WebP image.";
  }

  if (file.size > 5 * 1024 * 1024) {
    return "The image must be no larger than 5 MB.";
  }

  return null;
}

async function uploadCourseImage(
  supabase: ReturnType<typeof createBrowserSupabase>,
  file: File,
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
  const filePath = `courses/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }

  return supabase.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl;
}

export default function AdminCourses() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState<CourseForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setCourses([]);
    } else {
      setCourses((data ?? []) as Course[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  function updateField<K extends keyof CourseForm>(
    field: K,
    value: CourseForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setImageFile(null);
  }

  function startEditing(course: Course) {
    setEditingId(course.id);
    setForm({
      slug: course.slug ?? "",
      title: course.title ?? "",
      summary: course.summary ?? "",
      description: course.description ?? "",
      learning_outcomes: (course.learning_outcomes ?? []).join("\n"),
      instructor_name: course.instructor_name ?? "",
      instructor_bio: course.instructor_bio ?? "",
      requirements: course.requirements ?? "",
      certificate_criteria: course.certificate_criteria ?? "",
      thumbnail_url: course.thumbnail_url ?? "",
      price: course.price == null ? "" : String(course.price),
      level: course.level ?? "",
      duration: course.duration ?? "",
      delivery: course.delivery ?? "",
      module_count: String(course.module_count ?? 1),
      is_free: course.is_free ?? true,
      published: course.published ?? false,
    });
    setImageFile(null);
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    resetForm();
    setMessage("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || deletingId) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const slug = form.slug
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new Error(
          "Use lowercase letters, numbers, and single hyphens for the slug, e.g. intro-to-bioinformatics.",
        );
      }

      if (!form.title.trim()) {
        throw new Error("Please enter a course title.");
      }

      const moduleCount = Number(form.module_count);

      if (
        !Number.isInteger(moduleCount) ||
        moduleCount < 1 ||
        moduleCount > 100
      ) {
        throw new Error(
          "Module count must be a whole number between 1 and 100.",
        );
      }

      const parsedPrice =
        form.price.trim() === "" ? null : Number(form.price);

      if (
        parsedPrice !== null &&
        (!Number.isFinite(parsedPrice) || parsedPrice < 0)
      ) {
        throw new Error(
          "Price must be a valid number that is zero or greater.",
        );
      }

      // Keep the existing image unless a new file has been selected.
      let thumbnailUrl = form.thumbnail_url.trim();

      if (imageFile) {
        thumbnailUrl = await uploadCourseImage(supabase, imageFile);
      }

      const learningOutcomes = form.learning_outcomes
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);

      const payload = {
        slug,
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        description: form.description.trim() || null,
        learning_outcomes: learningOutcomes,
        instructor_name: form.instructor_name.trim() || null,
        instructor_bio: form.instructor_bio.trim() || null,
        requirements: form.requirements.trim() || null,
        certificate_criteria: form.certificate_criteria.trim() || null,
        thumbnail_url: thumbnailUrl || null,
        price: form.is_free || parsedPrice === null ? null : parsedPrice,
        level: form.level.trim() || null,
        duration: form.duration.trim() || null,
        delivery: form.delivery.trim() || null,
        module_count: moduleCount,
        is_free: form.is_free,
        published: form.published,
      };

      const result = editingId
        ? await supabase
            .from("courses")
            .update(payload)
            .eq("id", editingId)
        : await supabase.from("courses").insert(payload);

      if (result.error) {
        if (result.error.code === "23505") {
          throw new Error(
            "This course slug already exists. Please choose another.",
          );
        }

        throw new Error(result.error.message);
      }

      setMessage(
        editingId
          ? "Course updated successfully. Existing modules and their content are preserved."
          : "Course added successfully. Its module records have been created automatically.",
      );

      resetForm();
      await loadCourses();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(course: Course) {
    if (saving || deletingId) return;

    setMessage("");
    setError("");

    const { error: updateError } = await supabase
      .from("courses")
      .update({ published: !course.published })
      .eq("id", course.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage(
      course.published
        ? "Course unpublished successfully."
        : "Course published successfully.",
    );

    await loadCourses();
  }

  async function deleteCourse(course: Course) {
    if (saving || deletingId) return;

    const confirmed = window.confirm(
      `Delete "${course.title}"? Related modules, assignments, enrolments, and progress may also be deleted because of database relationships.`,
    );

    if (!confirmed) return;

    setDeletingId(course.id);
    setMessage("");
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("courses")
        .delete()
        .eq("id", course.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      if (editingId === course.id) {
        resetForm();
      }

      setMessage("Course deleted successfully.");
      await loadCourses();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete the course. Please try again.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredCourses = courses.filter((course) =>
    [
      course.title,
      course.slug,
      course.summary ?? "",
      course.description ?? "",
      course.level ?? "",
      course.instructor_name ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <main className="container-page py-10 md:py-14">
      <header className="mb-9 md:mb-12">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          BioCode Innovators
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Course management
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Create and manage course details, module counts, learning outcomes,
          instructors, requirements, pricing, images, and publication status.
        </p>
      </header>

      <section className={`${sectionClass} mb-12`}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              {editingId ? "Edit course" : "Add a course"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Course title and URL slug are required. Choose how many modules
              the course should contain. Save as a draft while preparing it.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="rounded-xl border border-current/15 px-4 py-2.5 text-sm transition hover:bg-current/5 disabled:opacity-50"
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
            className="mb-5 break-words rounded-xl border border-red-500/40 p-3 text-sm"
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <h3 className="mb-4 text-base font-semibold">Course basics</h3>

            <div className="grid gap-5 md:grid-cols-2">
              <label className={labelClass}>
                Course title *
                <input
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  className={inputClass}
                  placeholder="Introduction to Bioinformatics"
                />
              </label>

              <label className={labelClass}>
                URL slug *
                <input
                  required
                  maxLength={200}
                  value={form.slug}
                  onChange={(e) => updateField("slug", e.target.value)}
                  className={inputClass}
                  placeholder="intro-to-bioinformatics"
                />
                <span className="mt-1 block text-xs text-muted">
                  Used in the course URL: /courses/your-slug
                </span>
              </label>

              <label className={labelClass}>
                Number of modules *
                <input
                  required
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={form.module_count}
                  onChange={(e) =>
                    updateField("module_count", e.target.value)
                  }
                  className={inputClass}
                />
                <span className="mt-1 block text-xs text-muted">
                  Missing module records are created automatically when you
                  save. Existing modules and their content are preserved.
                </span>
              </label>

              <label className={labelClass}>
                Level
                <input
                  value={form.level}
                  onChange={(e) => updateField("level", e.target.value)}
                  className={inputClass}
                  placeholder="Beginner"
                />
              </label>

              <label className={labelClass}>
                Duration
                <input
                  value={form.duration}
                  onChange={(e) => updateField("duration", e.target.value)}
                  className={inputClass}
                  placeholder="4 weeks"
                />
              </label>

              <label className={labelClass}>
                Delivery method
                <input
                  value={form.delivery}
                  onChange={(e) => updateField("delivery", e.target.value)}
                  className={inputClass}
                  placeholder="YouTube sessions, live, or mixed"
                />
              </label>
            </div>

            <div className="mt-7 rounded-2xl border border-current/10 p-4 md:p-5">
              <div className="mb-4">
                <h4 className="font-semibold">Course cover image</h4>
                <p className="mt-1 text-sm text-muted">
                  Upload a cover image to display on the public courses page.
                  Recommended landscape image ratio: 16:9.
                </p>
              </div>

              {(previewUrl || form.thumbnail_url) ? (
                <div className="mb-4 max-w-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl || form.thumbnail_url}
                    alt="Course cover preview"
                    className="aspect-[16/9] w-full rounded-xl border border-current/10 object-cover"
                  />
                  <p className="mt-2 text-xs text-muted">
                    {imageFile
                      ? "New image selected. It will be uploaded when you save the course."
                      : "Current course cover image."}
                  </p>
                </div>
              ) : (
                <div className="mb-4 flex aspect-[16/9] max-w-xl items-center justify-center rounded-xl border border-dashed border-current/20 bg-current/[0.03] text-sm text-muted">
                  No course cover selected
                </div>
              )}

              <label className={labelClass}>
                {form.thumbnail_url ? "Replace cover image" : "Choose cover image"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={saving}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setError("");
                    setMessage("");

                    if (!file) {
                      setImageFile(null);
                      return;
                    }

                    const validationError = validateImage(file);

                    if (validationError) {
                      setError(validationError);
                      event.target.value = "";
                      setImageFile(null);
                      return;
                    }

                    setImageFile(file);
                  }}
                  className="mt-2 block w-full text-sm"
                />
                <span className="mt-1 block text-xs text-muted">
                  JPG, PNG, or WebP. Maximum 5 MB.
                </span>
              </label>

              {imageFile && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <p className="break-all text-xs text-muted">
                    Selected: {imageFile.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => setImageFile(null)}
                    disabled={saving}
                    className="text-xs font-semibold underline underline-offset-4 disabled:opacity-50"
                  >
                    Remove selection
                  </button>
                </div>
              )}

              <label className={`${labelClass} mt-5 block`}>
                Or use an existing image URL
                <input
                  type="url"
                  value={form.thumbnail_url}
                  onChange={(e) => {
                    updateField("thumbnail_url", e.target.value);
                    setImageFile(null);
                  }}
                  className={inputClass}
                  placeholder="https://..."
                  disabled={saving}
                />
                <span className="mt-1 block text-xs text-muted">
                  Optional. You can upload an image above or paste a public
                  HTTP/HTTPS image URL here.
                </span>
              </label>
            </div>
          </div>

          <div className="border-t border-current/10 pt-7">
            <h3 className="mb-4 text-base font-semibold">Course content</h3>

            <div className="space-y-5">
              <label className={labelClass}>
                Short summary
                <textarea
                  rows={2}
                  value={form.summary}
                  onChange={(e) => updateField("summary", e.target.value)}
                  className={inputClass}
                  placeholder="A short description for course cards."
                />
              </label>

              <label className={labelClass}>
                Full course description
                <textarea
                  rows={5}
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  className={inputClass}
                  placeholder="Explain what the course covers and who it is for."
                />
              </label>

              <label className={labelClass}>
                Learning outcomes
                <textarea
                  rows={4}
                  value={form.learning_outcomes}
                  onChange={(e) =>
                    updateField("learning_outcomes", e.target.value)
                  }
                  className={inputClass}
                  placeholder={
                    "Enter one outcome per line:\nUnderstand core concepts\nUse common bioinformatics tools"
                  }
                />
                <span className="mt-1 block text-xs text-muted">
                  Each non-empty line will be saved as a separate learning
                  outcome.
                </span>
              </label>
            </div>
          </div>

          <div className="border-t border-current/10 pt-7">
            <h3 className="mb-4 text-base font-semibold">
              Instructor and eligibility
            </h3>

            <div className="grid gap-5 md:grid-cols-2">
              <label className={labelClass}>
                Instructor name
                <input
                  value={form.instructor_name}
                  onChange={(e) =>
                    updateField("instructor_name", e.target.value)
                  }
                  className={inputClass}
                  placeholder="Instructor's name"
                />
              </label>

              <label className={labelClass}>
                Requirements / eligibility
                <textarea
                  rows={3}
                  value={form.requirements}
                  onChange={(e) =>
                    updateField("requirements", e.target.value)
                  }
                  className={inputClass}
                  placeholder="Prerequisites, background, or required tools"
                />
              </label>

              <label className={`${labelClass} md:col-span-2`}>
                Instructor bio
                <textarea
                  rows={3}
                  value={form.instructor_bio}
                  onChange={(e) =>
                    updateField("instructor_bio", e.target.value)
                  }
                  className={inputClass}
                  placeholder="A short instructor introduction."
                />
              </label>

              <label className={`${labelClass} md:col-span-2`}>
                Certificate criteria
                <textarea
                  rows={3}
                  value={form.certificate_criteria}
                  onChange={(e) =>
                    updateField("certificate_criteria", e.target.value)
                  }
                  className={inputClass}
                  placeholder="For example: complete all modules and pass required assessments."
                />
              </label>
            </div>
          </div>

          <div className="border-t border-current/10 pt-7">
            <h3 className="mb-4 text-base font-semibold">
              Access and publication
            </h3>

            <div className="grid gap-5 md:grid-cols-2">
              <label className={labelClass}>
                Price (optional)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => updateField("price", e.target.value)}
                  disabled={form.is_free}
                  className={`${inputClass} disabled:opacity-50`}
                  placeholder="0.00"
                />
                <span className="mt-1 block text-xs text-muted">
                  Payment processing is not configured by this form.
                </span>
              </label>

              <div className="flex flex-col gap-4 self-center">
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_free}
                    onChange={(e) => {
                      updateField("is_free", e.target.checked);
                      if (e.target.checked) updateField("price", "");
                    }}
                    className="size-4"
                  />
                  This course is free
                </label>

                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) =>
                      updateField("published", e.target.checked)
                    }
                    className="size-4"
                  />
                  Publish immediately
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-current/10 pt-6">
            <button
              type="submit"
              disabled={saving || deletingId !== null}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? imageFile
                  ? "Uploading image and saving..."
                  : "Saving..."
                : editingId
                  ? "Save changes"
                  : "Add course"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="rounded-xl border border-current/15 px-5 py-3 text-sm transition hover:bg-current/5 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section>
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold">Courses</h2>
            <p className="mt-1 text-sm text-muted">
              {courses.length} {courses.length === 1 ? "course" : "courses"} in
              your database
            </p>
          </div>

          <label className="block text-sm">
            Search courses
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-2 w-full rounded-xl border border-current/15 bg-transparent px-3.5 py-3 sm:w-80"
              placeholder="Search title, slug, instructor..."
            />
          </label>
        </div>

        {loading ? (
          <p className="py-10 text-muted">Loading courses...</p>
        ) : filteredCourses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-current/20 p-8 text-center">
            <p className="font-medium">No courses found.</p>
            <p className="mt-2 text-sm text-muted">
              Add a course above or try a different search.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCourses.map((course) => (
              <article
                key={course.id}
                className="rounded-2xl border border-current/10 p-5 md:p-6"
              >
                <div className="flex flex-col justify-between gap-5 md:flex-row">
                  <div className="min-w-0 flex-1">
                    {course.thumbnail_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.thumbnail_url}
                        alt={`${course.title} cover`}
                        className="mb-4 aspect-[16/7] w-full max-w-md rounded-xl object-cover"
                      />
                    )}

                    <h3 className="text-lg font-semibold">{course.title}</h3>

                    <p className="mt-1 break-all text-sm text-muted">
                      /courses/{course.slug}
                    </p>

                    {course.summary && (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-muted">
                        {course.summary}
                      </p>
                    )}

                    {course.instructor_name && (
                      <p className="mt-3 text-sm">
                        Instructor: {course.instructor_name}
                      </p>
                    )}

                    <p className="mt-3 text-sm text-muted">
                      {course.level || "Level not set"} |{" "}
                      {course.duration || "Duration not set"} |{" "}
                      {course.delivery || "Delivery not set"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-current/15 px-3 py-1">
                        {course.is_free
                          ? "Free"
                          : `Paid${course.price != null ? ` | ${course.price}` : ""}`}
                      </span>

                      <span className="rounded-full border border-current/15 px-3 py-1">
                        {course.published ? "Published" : "Draft"}
                      </span>

                      <span className="rounded-full border border-current/15 px-3 py-1">
                        {course.module_count ?? 1} modules
                      </span>

                      <span className="rounded-full border border-current/15 px-3 py-1">
                        {(course.learning_outcomes ?? []).length} learning
                        outcomes
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
                    <button
                      type="button"
                      onClick={() => startEditing(course)}
                      disabled={saving || deletingId !== null}
                      className="rounded-xl border border-current/15 px-4 py-2.5 text-sm transition hover:bg-current/5 disabled:opacity-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => void togglePublished(course)}
                      disabled={saving || deletingId !== null}
                      className="rounded-xl border border-current/15 px-4 py-2.5 text-sm transition hover:bg-current/5 disabled:opacity-50"
                    >
                      {course.published ? "Unpublish" : "Publish"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void deleteCourse(course)}
                      disabled={deletingId !== null || saving}
                      className="rounded-xl border border-red-500/40 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-500/5 disabled:opacity-50"
                    >
                      {deletingId === course.id ? "Deleting..." : "Delete"}
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
