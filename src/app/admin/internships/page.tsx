"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import InternshipTasksPanel from "./InternshipTasksPanel";
import InternshipPaymentSettings from "./InternshipPaymentSettings";

type Internship = {
  id: string;
  title: string;
  department: string | null;
  duration: string | null;
  mode: string | null;
  is_paid: boolean;
  stipend_details: string | null;
  contact_email: string | null;
  end_date: string | null;
  instructions: string | null;
  is_open: boolean | null;
  description: string | null;
  image_url: string | null;
  created_at: string;
  published: boolean;
  tasks_pdf_path: string | null;
  letter_template_path: string | null;
  certificate_template_path: string | null;
  appreciation_template_path: string | null;
};

type InternshipForm = {
  title: string;
  department: string;
  duration: string;
  mode: string;
  is_paid: boolean;
  stipend_details: string;
  contact_email: string;
  end_date: string;
  instructions: string;
  is_open: boolean;
  description: string;
  published: boolean;
};

const emptyForm: InternshipForm = {
  title: "",
  department: "",
  duration: "",
  mode: "Remote",
  is_paid: false,
  stipend_details: "",
  contact_email: "",
  end_date: "",
  instructions: "",
  is_open: true,
  description: "",
  published: false,
};

const BUCKET = "internship-images";
const FILES_BUCKET = "internship-files";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function AdminInternships() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [internships, setInternships] = useState<Internship[]>([]);
  const [form, setForm] = useState<InternshipForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageInputKey, setImageInputKey] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadInternships = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("internships")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setInternships([]);
      } else {
        setInternships((data ?? []) as Internship[]);
      }

      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    void loadInternships();
  }, [loadInternships]);

  function updateField<K extends keyof InternshipForm>(
    field: K,
    value: InternshipForm[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setCurrentImage(null);
    setSelectedImage(null);
    setImageInputKey((key) => key + 1);
  }

  function startEditing(internship: Internship) {
    setEditingId(internship.id);
    setForm({
      title: internship.title ?? "",
      department: internship.department ?? "",
      duration: internship.duration ?? "",
      mode: internship.mode ?? "Remote",
      is_paid: internship.is_paid ?? false,
      stipend_details: internship.stipend_details ?? "",
      contact_email: internship.contact_email ?? "",
      end_date: internship.end_date ?? "",
      instructions: internship.instructions ?? "",
      is_open: internship.is_open ?? true,
      description: internship.description ?? "",
      published: internship.published ?? false,
    });
    setCurrentImage(internship.image_url);
    setSelectedImage(null);
    setImageInputKey((key) => key + 1);
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    let uploadedPath: string | null = null;

    try {
      if (!form.title.trim()) {
        setError("Please enter an internship title.");
        return;
      }

      if (
        form.contact_email.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())
      ) {
        setError("Please enter a valid application email address.");
        return;
      }

      if (selectedImage) {
        if (!selectedImage.type.startsWith("image/")) {
          setError("Please select a valid image file.");
          return;
        }

        if (selectedImage.size > MAX_IMAGE_SIZE) {
          setError("Please choose an image smaller than 5 MB.");
          return;
        }

        const extension =
          selectedImage.name.split(".").pop()?.toLowerCase() || "jpg";
        const filePath = `${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, selectedImage, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          setError(`Image upload failed: ${uploadError.message}`);
          return;
        }

        uploadedPath = filePath;
      }

      const newImageUrl = uploadedPath
        ? supabase.storage.from(BUCKET).getPublicUrl(uploadedPath).data
            .publicUrl
        : currentImage;

      const payload = {
        title: form.title.trim(),
        department: form.department.trim() || null,
        duration: form.duration.trim() || null,
        mode: form.mode,
        is_paid: form.is_paid,
        stipend_details: form.stipend_details.trim() || null,
        contact_email: form.contact_email.trim() || null,
        end_date: form.end_date || null,
        instructions: form.instructions.trim() || null,
        is_open: form.is_open,
        description: form.description.trim() || null,
        image_url: newImageUrl,
        published: form.published,
      };

      const result = editingId
        ? await supabase
            .from("internships")
            .update(payload)
            .eq("id", editingId)
            .select("id")
        : await supabase
            .from("internships")
            .insert(payload)
            .select("id");

      if (result.error) {
        if (uploadedPath) {
          await supabase.storage.from(BUCKET).remove([uploadedPath]);
        }

        setError(result.error.message);
        return;
      }

      if (!result.data?.length) {
        setError(
          "No internship was saved. Check your Supabase database permissions."
        );
        return;
      }

      setMessage(
        editingId
          ? "Internship updated successfully."
          : "Internship added successfully."
      );

      resetForm();
      await loadInternships();
    } catch {
      if (uploadedPath) {
        await supabase.storage.from(BUCKET).remove([uploadedPath]);
      }

      setError("Something went wrong while saving. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(internship: Internship) {
    setMessage("");
    setError("");

    const { data, error: updateError } = await supabase
      .from("internships")
      .update({ published: !internship.published })
      .eq("id", internship.id)
      .select("id");

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (!data?.length) {
      setError("Could not change status. Check your database permissions.");
      return;
    }

    setMessage(
      internship.published
        ? "Internship unpublished successfully."
        : "Internship published successfully."
    );

    await loadInternships(true);
  }

  async function toggleOpen(internship: Internship) {
    setMessage("");
    setError("");

    const { data, error: updateError } = await supabase
      .from("internships")
      .update({ is_open: !internship.is_open })
      .eq("id", internship.id)
      .select("id");

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (!data?.length) {
      setError("Could not change application status.");
      return;
    }

    setMessage(
      internship.is_open
        ? "Applications closed."
        : "Applications reopened."
    );

    await loadInternships(true);
  }

  async function deleteInternship(internship: Internship) {
    if (
      !window.confirm(
        `Delete "${internship.title}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(internship.id);
    setMessage("");
    setError("");

    try {
      const { data, error: deleteError } = await supabase
        .from("internships")
        .delete()
        .eq("id", internship.id)
        .select("id");

      if (deleteError) {
        setError(
          deleteError.code === "23503"
            ? "This internship already has enrolled students, so it can't be deleted. Close applications and unpublish it instead."
            : deleteError.message
        );
        return;
      }

      if (!data?.length) {
        setError("Could not delete the internship. Check database permissions.");
        return;
      }

      // Remove private task / template files after the database row is gone.
      const privateFiles = [
        internship.tasks_pdf_path,
        internship.certificate_template_path,
        internship.appreciation_template_path,
      ].filter((path): path is string => Boolean(path));

      if (privateFiles.length) {
        await supabase.storage.from(FILES_BUCKET).remove(privateFiles);
      }

      // Remove the image only after the database row is deleted.
      if (internship.image_url) {
        const marker = `/${BUCKET}/`;
        const position = internship.image_url.indexOf(marker);

        if (position !== -1) {
          const imagePath = internship.image_url.slice(
            position + marker.length
          );

          const { error: imageError } = await supabase.storage
            .from(BUCKET)
            .remove([decodeURIComponent(imagePath)]);

          if (imageError) {
            setError(
              `Internship deleted, but its image could not be removed: ${imageError.message}`
            );
          }
        }
      }

      if (editingId === internship.id) {
        resetForm();
      }

      if (expandedId === internship.id) {
        setExpandedId(null);
      }

      if (!error) {
        setMessage("Internship deleted successfully.");
      }

      await loadInternships();
    } catch {
      setError("Could not delete the internship. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const filteredInternships = internships.filter((internship) =>
    [
      internship.title,
      internship.department ?? "",
      internship.description ?? "",
      internship.mode ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <main className="container-page py-12">
      <header className="mb-10">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted">
          BioCode Innovators · Research Wing
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Internship management
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Create opportunities, upload images, manage applications, and publish
          internship listings. Use “Tasks &amp; files” on an internship to add
          its tasks, task PDF, and certificate and appreciation letter templates.
        </p>
      </header>

      <section className="mb-12 rounded-2xl border border-current/10 p-5 md:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              {editingId ? "Edit internship" : "Add an internship"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Title is required. Save as a draft before publishing if needed.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-current/20 px-4 py-2 text-sm hover:bg-current/5"
            >
              Cancel editing
            </button>
          )}
        </div>

        {message && (
          <p
            role="status"
            className="mb-5 rounded-lg border border-green-600/30 p-3 text-sm"
          >
            {message}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mb-5 break-words rounded-lg border border-red-500/40 p-3 text-sm"
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Internship title *
              <input
                required
                maxLength={200}
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
                placeholder="Bioinformatics Research Intern"
              />
            </label>

            <label className="block text-sm font-medium">
              Department
              <input
                value={form.department}
                onChange={(e) => updateField("department", e.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
                placeholder="Computational Biology"
              />
            </label>

            <label className="block text-sm font-medium">
              Duration
              <input
                value={form.duration}
                onChange={(e) => updateField("duration", e.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
                placeholder="8 weeks"
              />
            </label>

            <label className="block text-sm font-medium">
              Work arrangement
              <select
                value={form.mode}
                onChange={(e) => updateField("mode", e.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
              >
                <option value="Remote">Remote</option>
                <option value="On-site">On-site</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </label>

            <label className="block text-sm font-medium">
              Application email
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => updateField("contact_email", e.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
                placeholder="internships@yourdomain.com"
              />
            </label>
            <label className="block text-sm font-medium">
              Internship end date (shared task deadline)
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => updateField("end_date", e.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
              />
            </label>
          <label className="block text-sm font-medium">
            Internship instructions (shown to students after they apply)
            <textarea
              rows={6}
              value={form.instructions}
              onChange={(e) => updateField("instructions", e.target.value)}
              className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
              placeholder="Expectations, communication rules, how to submit, grading..."
            />
          </label>
          </div>

          <label className="block text-sm font-medium">
            Internship description
            <textarea
              rows={6}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
              placeholder="Describe responsibilities, learning outcomes, eligibility, required skills, and how to apply..."
            />
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Stipend details
              <input
                value={form.stipend_details}
                onChange={(e) =>
                  updateField("stipend_details", e.target.value)
                }
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
                placeholder="e.g. PKR 25,000 per month"
              />
            </label>

            <label className="block text-sm font-medium">
              Internship image
              <input
                key={imageInputKey}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) =>
                  setSelectedImage(e.target.files?.[0] ?? null)
                }
                className="mt-2 block w-full text-sm"
              />
              <span className="mt-1 block text-xs text-muted">
                PNG, JPEG, or WebP. Maximum 5 MB.
              </span>
            </label>
          </div>

          {(selectedImage || currentImage) && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Image preview</p>
              {selectedImage ? (
                <p className="text-sm text-muted">
                  Selected: {selectedImage.name}
                </p>
              ) : null}
              <div className="flex flex-wrap items-start gap-4">
                <div className="max-w-xs">
                  {selectedImage ? (
                    <ImagePreview file={selectedImage} />
                  ) : currentImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentImage}
                      alt="Current internship"
                      className="max-h-48 rounded-xl border border-current/10 object-cover"
                    />
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImage(null);
                    setCurrentImage(null);
                    setImageInputKey((key) => key + 1);
                  }}
                  className="rounded-lg border border-current/20 px-3 py-2 text-sm hover:bg-current/5"
                >
                  Remove image
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_paid}
                onChange={(e) => updateField("is_paid", e.target.checked)}
                className="size-4"
              />
              This internship is paid
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_open}
                onChange={(e) => updateField("is_open", e.target.checked)}
                className="size-4"
              />
              Accepting applications
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => updateField("published", e.target.checked)}
                className="size-4"
              />
              Publish immediately
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Save changes"
                : "Add internship"}
          </button>
        </form>
      </section>

      <section>
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold">Internships</h2>
            <p className="mt-1 text-sm text-muted">
              {internships.length}{" "}
              {internships.length === 1 ? "internship" : "internships"} in your
              database
            </p>
          </div>

          <label className="block text-sm">
            Search internships
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 sm:w-72"
              placeholder="Search title, department, or mode"
            />
          </label>
        </div>

        {loading ? (
          <p className="py-10 text-muted">Loading internships...</p>
        ) : filteredInternships.length === 0 ? (
          <div className="rounded-xl border border-dashed border-current/20 p-8 text-center">
            <p className="font-medium">No internships found.</p>
            <p className="mt-2 text-sm text-muted">
              Add an internship above or try a different search.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInternships.map((internship) => (
              <article
                key={internship.id}
                className="rounded-xl border border-current/10 p-5 md:p-6"
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row">
                  <div className="min-w-0 flex-1">
                    {internship.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={internship.image_url}
                        alt={internship.title}
                        className="mb-4 max-h-52 rounded-xl object-cover"
                      />
                    )}

                    <h3 className="text-lg font-semibold">
                      {internship.title}
                    </h3>

                    <p className="mt-2 text-sm text-muted">
                      {internship.department || "Department not specified"} ·{" "}
                      {internship.duration || "Duration not specified"} ·{" "}
                      {internship.mode || "Mode not specified"}
                    </p>

                    {internship.description && (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-muted">
                        {internship.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-current/15 px-3 py-1">
                        {internship.is_paid ? "Paid" : "Unpaid"}
                      </span>
                      <span className="rounded-full border border-current/15 px-3 py-1">
                        {internship.published ? "Published" : "Draft"}
                      </span>
                      <span className="rounded-full border border-current/15 px-3 py-1">
                        {internship.is_open
                          ? "Applications open"
                          : "Applications closed"}
                      </span>
                    </div>

                    {internship.stipend_details && (
                      <p className="mt-3 text-sm">
                        Stipend: {internship.stipend_details}
                      </p>
                    )}

                    {internship.contact_email && (
                      <p className="mt-1 break-all text-sm text-muted">
                        Apply via: {internship.contact_email}
                      </p>
                    )}
                    {internship.end_date && (
                      <p className="mt-1 text-sm text-muted">
                        Ends: {internship.end_date}
                      </p>
                    )}

                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
                    <button
                      type="button"
                      onClick={() => startEditing(internship)}
                      className="rounded-lg border border-current/20 px-4 py-2 text-sm hover:bg-current/5"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId((current) =>
                          current === internship.id ? null : internship.id
                        )
                      }
                      aria-expanded={expandedId === internship.id}
                      className="rounded-lg border border-current/20 px-4 py-2 text-sm hover:bg-current/5"
                    >
                      {expandedId === internship.id
                        ? "Hide tasks & files"
                        : "Tasks & files"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void togglePublished(internship)}
                      className="rounded-lg border border-current/20 px-4 py-2 text-sm hover:bg-current/5"
                    >
                      {internship.published ? "Unpublish" : "Publish"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void toggleOpen(internship)}
                      className="rounded-lg border border-current/20 px-4 py-2 text-sm hover:bg-current/5"
                    >
                      {internship.is_open ? "Close applications" : "Reopen"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void deleteInternship(internship)}
                      disabled={deletingId === internship.id}
                      className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-600 hover:bg-red-500/5 disabled:opacity-50"
                    >
                      {deletingId === internship.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>

                {expandedId === internship.id && (
                  <InternshipTasksPanel
                    internshipId={internship.id}
                    tasksPdfPath={internship.tasks_pdf_path}
                    certificateTemplatePath={
                      internship.certificate_template_path
                    }
                    appreciationTemplatePath={
                      internship.appreciation_template_path
                    }
                    onFilesChangedAction={() => loadInternships(true)}
                  />
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <InternshipPaymentSettings />
    </main>
  );
}

function ImagePreview({ file }: { file: File }) {
  const [preview, setPreview] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!preview) return null;

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={preview}
      alt="Selected internship preview"
      className="max-h-48 rounded-xl border border-current/10 object-cover"
    />
  );
}
