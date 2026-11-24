"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

type StudentJournal = {
  id: string;
  title: string;
  student_name: string;
  publication_date: string;
  domain: string;
  description: string | null;
  pdf_url: string;
  image_url: string | null;
  is_published: boolean;
  is_featured: boolean;
  featured_order: number;
  created_at: string;
  updated_at: string;
};

const BUCKET = "research-journal-assets";
const MAX_FEATURED = 8;

async function uploadJournalFile(
  supabase: ReturnType<typeof createBrowserSupabase>,
  file: File,
  folder: "pdfs" | "images"
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
  const filePath = `${folder}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    throw new Error(`File upload failed: ${error.message}`);
  }

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

function validatePdf(file: File) {
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Please select a PDF file.");
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error("The PDF must be 20 MB or smaller.");
  }
}

function validateImage(file: File) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Use a JPG, PNG, or WebP image.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("The cover image must be 5 MB or smaller.");
  }
}

export default function AdminStudentJournalPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [entries, setEntries] = useState<StudentJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [studentName, setStudentName] = useState("");
  const [publicationDate, setPublicationDate] = useState("");
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingPdfUrl, setExistingPdfUrl] = useState("");
  const [existingImageUrl, setExistingImageUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("student_journals")
      .select("*")
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(
        `Could not load journal entries: ${queryError.message}`
      );
      setEntries([]);
    } else {
      setEntries((data ?? []) as StudentJournal[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setStudentName("");
    setPublicationDate("");
    setDomain("");
    setDescription("");
    setPdfFile(null);
    setImageFile(null);
    setExistingPdfUrl("");
    setExistingImageUrl("");
    setIsPublished(false);
    setError("");

    const form = document.getElementById(
      "student-journal-form"
    ) as HTMLFormElement | null;

    form?.reset();
  }

  function startEditing(entry: StudentJournal) {
    setEditingId(entry.id);
    setTitle(entry.title);
    setStudentName(entry.student_name);
    setPublicationDate(entry.publication_date);
    setDomain(entry.domain);
    setDescription(entry.description ?? "");
    setExistingPdfUrl(entry.pdf_url);
    setExistingImageUrl(entry.image_url ?? "");
    setPdfFile(null);
    setImageFile(null);
    setIsPublished(entry.is_published);
    setError("");
    setMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (pdfFile) validatePdf(pdfFile);
      if (imageFile) validateImage(imageFile);

      if (!editingId && !pdfFile) {
        throw new Error("Please upload a PDF for this journal entry.");
      }

      let pdfUrl = existingPdfUrl;
      let imageUrl = existingImageUrl || null;

      if (pdfFile) {
        pdfUrl = await uploadJournalFile(
          supabase,
          pdfFile,
          "pdfs"
        );
      }

      if (imageFile) {
        imageUrl = await uploadJournalFile(
          supabase,
          imageFile,
          "images"
        );
      }

      if (!pdfUrl) {
        throw new Error("A research paper PDF is required.");
      }

      const payload = {
        title: title.trim(),
        student_name: studentName.trim(),
        publication_date: publicationDate,
        domain: domain.trim(),
        description: description.trim() || null,
        pdf_url: pdfUrl,
        image_url: imageUrl,
        is_published: isPublished,
        // A draft can never stay in the public carousel.
        ...(isPublished ? {} : { is_featured: false }),
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from("student_journals")
          .update(payload)
          .eq("id", editingId);

        if (updateError) throw updateError;

        setMessage("Student journal entry updated successfully.");
      } else {
        const { error: insertError } = await supabase
          .from("student_journals")
          .insert(payload);

        if (insertError) throw insertError;

        setMessage("Student journal entry added successfully.");
      }

      resetForm();
      await loadEntries();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while saving."
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(entry: StudentJournal) {
    setError("");
    setMessage("");

    const { error: updateError } = await supabase
      .from("student_journals")
      .update({
        is_published: !entry.is_published,
        // Unpublishing also removes it from the featured carousel.
        ...(entry.is_published ? { is_featured: false } : {}),
      })
      .eq("id", entry.id);

    if (updateError) {
      setError(`Could not update status: ${updateError.message}`);
      return;
    }

    setMessage(
      entry.is_published
        ? "Entry unpublished successfully."
        : "Entry published successfully."
    );

    await loadEntries();
  }

  async function toggleFeatured(entry: StudentJournal) {
    setError("");
    setMessage("");

    if (!entry.is_featured && !entry.is_published) {
      setError(
        "Publish this entry first. Only published entries can appear in the carousel."
      );
      return;
    }

    const nextFeatured = !entry.is_featured;

    // The database also enforces the limit of 8 featured entries.
    const { data, error: updateError } = await supabase
      .from("student_journals")
      .update({ is_featured: nextFeatured })
      .eq("id", entry.id)
      .select("id, is_featured");

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (!data || data.length === 0) {
      setError(
        "The featured status was not changed. Check your admin permissions."
      );
      return;
    }

    setEntries((current) =>
      current.map((item) =>
        item.id === entry.id
          ? { ...item, is_featured: data[0].is_featured }
          : item
      )
    );

    setMessage(
      nextFeatured
        ? "Entry added to the Student Journal carousel."
        : "Entry removed from the Student Journal carousel."
    );
  }

  async function updateFeaturedOrder(
    entry: StudentJournal,
    value: string
  ) {
    const order = Number(value);

    if (!value.trim() || !Number.isInteger(order) || order < 0) {
      setError("Carousel position must be a whole number, 0 or higher.");
      return;
    }

    if (order === entry.featured_order) return;

    setError("");
    setMessage("");

    const { data, error: updateError } = await supabase
      .from("student_journals")
      .update({ featured_order: order })
      .eq("id", entry.id)
      .select("id, featured_order");

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (!data || data.length === 0) {
      setError(
        "The carousel position was not changed. Check your admin permissions."
      );
      return;
    }

    setEntries((current) =>
      current.map((item) =>
        item.id === entry.id
          ? { ...item, featured_order: data[0].featured_order }
          : item
      )
    );

    setMessage("Carousel position updated. Lower numbers appear first.");
  }

  async function deleteEntry(entry: StudentJournal) {
    const confirmed = window.confirm(
      `Delete "${entry.title}"? This will remove the database record. Previously uploaded Storage files may need separate removal.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("student_journals")
      .delete()
      .eq("id", entry.id);

    if (deleteError) {
      setError(`Could not delete entry: ${deleteError.message}`);
      return;
    }

    if (editingId === entry.id) resetForm();

    setMessage("Student journal entry deleted.");
    await loadEntries();
  }

  const featuredCount = entries.filter((entry) => entry.is_featured).length;

  const filteredEntries = entries.filter((entry) => {
    const query = search.toLowerCase();

    return [
      entry.title,
      entry.student_name,
      entry.domain,
      entry.description ?? "",
    ].some((value) => value.toLowerCase().includes(query));
  });

  return (
    <main className="container-page py-10">
      <header className="mb-8">
        <p className="text-sm text-muted">
          BioCode Innovators · Student Journal
        </p>

        <h1 className="mt-2 text-3xl font-semibold">
          Manage Student Journal
        </h1>

        <p className="mt-3 max-w-2xl text-muted">
          Add student research, upload papers and cover images,
          manage publication details, and control what visitors
          can see on the public Student Journal page.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-300 p-4 text-red-700"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="mb-5 rounded-lg border border-green-300 p-4"
        >
          {message}
        </div>
      )}

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-xl font-semibold">
          {editingId ? "Edit journal entry" : "Add a journal entry"}
        </h2>

        <p className="mt-2 text-sm text-muted">
          Title, student name, publication date, domain, and PDF
          are required. Cover image and description are optional.
        </p>

        <form
          id="student-journal-form"
          onSubmit={handleSubmit}
          className="mt-6 grid gap-5 md:grid-cols-2"
        >
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium">Research title *</span>
            <input
              className="w-full rounded-lg border border-line bg-transparent p-3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter the research title"
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Student name *</span>
            <input
              className="w-full rounded-lg border border-line bg-transparent p-3"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Student's full name"
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">
              Publication date *
            </span>
            <input
              type="date"
              className="w-full rounded-lg border border-line bg-transparent p-3"
              value={publicationDate}
              onChange={(e) => setPublicationDate(e.target.value)}
              required
            />
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium">
              Research domain / topic *
            </span>
            <input
              className="w-full rounded-lg border border-line bg-transparent p-3"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. Bioinformatics, Genomics, Computational Biology"
              required
            />
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium">
              Research paper PDF {!editingId && "*"}
            </span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="w-full rounded-lg border border-line p-3"
              onChange={(e) =>
                setPdfFile(e.target.files?.[0] ?? null)
              }
              required={!editingId && !existingPdfUrl}
            />
            <span className="text-xs text-muted">
              PDF only, maximum 20 MB.
            </span>

            {existingPdfUrl && (
              <a
                href={existingPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline"
              >
                View current PDF
              </a>
            )}
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium">Cover image</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="w-full rounded-lg border border-line p-3"
              onChange={(e) =>
                setImageFile(e.target.files?.[0] ?? null)
              }
            />
            <span className="text-xs text-muted">
              JPG, PNG, or WebP, maximum 5 MB.
              Selecting a new image replaces the displayed image.
            </span>

            {existingImageUrl && (
              <a
                href={existingImageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline"
              >
                View current cover image
              </a>
            )}
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium">
              Description / abstract
            </span>
            <textarea
              className="min-h-32 w-full rounded-lg border border-line bg-transparent p-3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the research, its purpose, and key findings..."
              rows={5}
            />
          </label>

          <label className="flex items-start gap-3 md:col-span-2">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">
                Publish this journal entry
              </span>
              <span className="mt-1 block text-sm text-muted">
                Unchecked entries are drafts and should not appear
                on the public Student Journal page.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap gap-3 md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="btn disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save changes"
                  : "Add journal entry"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-lg border border-line px-5 py-3"
              >
                Cancel editing
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">
              Student journal entries
            </h2>
            <p className="mt-2 text-sm text-muted">
              {entries.length}{" "}
              {entries.length === 1 ? "entry" : "entries"} in your database
            </p>
            <p className="mt-1 text-sm text-muted">
              Featured in the carousel: {featuredCount} / {MAX_FEATURED}.
              Only published entries can be featured.
            </p>
          </div>

          <input
            aria-label="Search journal entries"
            className="w-full rounded-lg border border-line bg-transparent p-3 md:max-w-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, student, domain..."
          />
        </div>

        {loading ? (
          <p className="py-10 text-muted">Loading journal entries...</p>
        ) : filteredEntries.length === 0 ? (
          <p className="py-10 text-muted">
            No journal entries found. Add one above or try a different search.
          </p>
        ) : (
          <div className="mt-6 grid gap-5">
            {filteredEntries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-xl border border-line bg-surface p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        {entry.title}
                      </h3>

                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          entry.is_published
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {entry.is_published ? "Published" : "Draft"}
                      </span>

                      {entry.is_featured && (
                        <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs text-cyan-900">
                          ★ In carousel
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-muted">
                      {entry.student_name} · {entry.domain}
                    </p>

                    <p className="mt-1 text-sm text-muted">
                      Publication date: {entry.publication_date}
                    </p>

                    {entry.description && (
                      <p className="mt-3 whitespace-pre-wrap">
                        {entry.description}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-4 text-sm">
                      <a
                        href={entry.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Open PDF
                      </a>

                      {entry.image_url && (
                        <a
                          href={entry.image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          Open cover image
                        </a>
                      )}
                    </div>
                  </div>

                  {entry.image_url && (
                    <img
                      src={entry.image_url}
                      alt={`Cover for ${entry.title}`}
                      className="h-28 w-24 rounded-lg border border-line object-cover"
                    />
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                  <button
                    type="button"
                    onClick={() => startEditing(entry)}
                    className="rounded-lg border border-line px-4 py-2"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => void togglePublished(entry)}
                    className="rounded-lg border border-line px-4 py-2"
                  >
                    {entry.is_published ? "Unpublish" : "Publish"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void toggleFeatured(entry)}
                    className="rounded-lg border border-line px-4 py-2"
                    aria-pressed={entry.is_featured}
                  >
                    {entry.is_featured
                      ? "★ Remove from carousel"
                      : "☆ Add to carousel"}
                  </button>

                  {entry.is_featured && (
                    <label className="flex items-center gap-2 text-sm">
                      <span className="text-muted">Position</span>
                      <input
                        key={`${entry.id}-${entry.featured_order}`}
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={entry.featured_order}
                        onBlur={(e) =>
                          void updateFeaturedOrder(entry, e.target.value)
                        }
                        className="w-20 rounded-lg border border-line bg-transparent px-2 py-2"
                      />
                    </label>
                  )}

                  <button
                    type="button"
                    onClick={() => void deleteEntry(entry)}
                    className="rounded-lg border border-red-300 px-4 py-2 text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
