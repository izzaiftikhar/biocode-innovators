"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Publication = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  doi: string | null;
  external_url: string;
  abstract: string | null;
  pdf_url: string | null;
  image_url: string | null;
  is_published: boolean;
  featured_on_home: boolean;
  is_featured: boolean;
  featured_order: number;
};

type PublicationForm = {
  title: string;
  authors: string;
  year: string;
  journal: string;
  doi: string;
  external_url: string;
  abstract: string;
};

const emptyForm: PublicationForm = {
  title: "",
  authors: "",
  year: "",
  journal: "",
  doi: "",
  external_url: "",
  abstract: "",
};

const BUCKET = "research-journal-assets";
const MAX_FEATURED = 8;

async function uploadPublicationFile(
  supabase: ReturnType<typeof createBrowserSupabase>,
  file: File,
  folder: "pdfs" | "images"
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
  const filePath = `${folder}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    throw new Error(`File upload failed: ${error.message}`);
  }

  return supabase.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl;
}

function validatePublicationFile(
  file: File,
  type: "pdf" | "image"
): string | null {
  if (type === "pdf") {
    if (
      file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return "Please select a PDF file.";
    }

    if (file.size > 20 * 1024 * 1024) {
      return "The PDF must be no larger than 20 MB.";
    }
  }

  if (type === "image") {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      return "Please select a JPG, PNG, or WebP image.";
    }

    if (file.size > 5 * 1024 * 1024) {
      return "The image must be no larger than 5 MB.";
    }
  }

  return null;
}

export default function AdminPublicationsPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [publications, setPublications] = useState<Publication[]>([]);
  const [form, setForm] = useState<PublicationForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingPdfUrl, setExistingPdfUrl] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(true);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadPublications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchError } = await supabase
        .from("publications")
        .select(
          "id, title, authors, year, journal, doi, external_url, abstract, pdf_url, image_url, is_published, featured_on_home, is_featured, featured_order"
        )
        .order("year", { ascending: false, nullsFirst: false });

      if (fetchError) throw fetchError;

      setPublications((data ?? []) as Publication[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load publications. Please try again."
      );
      setPublications([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadPublications();
  }, [loadPublications]);

  function updateField(field: keyof PublicationForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setPdfFile(null);
    setImageFile(null);
    setExistingPdfUrl(null);
    setExistingImageUrl(null);
    setIsPublished(true);
  }

  function startEditing(publication: Publication) {
    setEditingId(publication.id);

    setForm({
      title: publication.title ?? "",
      authors: (publication.authors ?? []).join(", "),
      year: publication.year?.toString() ?? "",
      journal: publication.journal ?? "",
      doi: publication.doi ?? "",
      external_url: publication.external_url ?? "",
      abstract: publication.abstract ?? "",
    });

    setExistingPdfUrl(publication.pdf_url);
    setExistingImageUrl(publication.image_url);
    setIsPublished(publication.is_published);
    setPdfFile(null);
    setImageFile(null);
    setMessage("");
    setError("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const title = form.title.trim();
      const authors = form.authors
        .split(",")
        .map((author) => author.trim())
        .filter(Boolean);

      const yearText = form.year.trim();
      const yearNumber = yearText ? Number(yearText) : null;

      if (!title) throw new Error("Please enter a publication title.");
      if (authors.length === 0) {
        throw new Error("Please enter at least one author.");
      }

      if (
        yearNumber !== null &&
        (!Number.isInteger(yearNumber) ||
          yearNumber < 1 ||
          yearNumber > 9999)
      ) {
        throw new Error("Please enter a valid publication year.");
      }

      const externalUrl = form.external_url.trim();

      if (externalUrl) {
        let parsedUrl: URL;

        try {
          parsedUrl = new URL(externalUrl);
        } catch {
          throw new Error("Please enter a valid publication URL.");
        }

        if (
          parsedUrl.protocol !== "https:" &&
          parsedUrl.protocol !== "http:"
        ) {
          throw new Error("Please use an HTTP or HTTPS publication URL.");
        }
      }

      // Upload any replacement files first.
      const pdfUrl = pdfFile
        ? await uploadPublicationFile(supabase, pdfFile, "pdfs")
        : existingPdfUrl;

      const imageUrl = imageFile
        ? await uploadPublicationFile(supabase, imageFile, "images")
        : existingImageUrl;

      // external_url is required by the existing database schema.
      // An uploaded PDF can also serve as the publication URL.
      const finalExternalUrl = externalUrl || pdfUrl;

      if (!finalExternalUrl) {
        throw new Error(
          "Please provide an external publication URL or upload a research PDF."
        );
      }

      const payload = {
        title,
        authors,
        year: yearNumber,
        journal: form.journal.trim() || null,
        doi: form.doi.trim() || null,
        external_url: finalExternalUrl,
        abstract: form.abstract.trim() || null,
        pdf_url: pdfUrl,
        image_url: imageUrl,
        is_published: isPublished,
        // A draft can never stay in the public carousel.
        ...(isPublished ? {} : { is_featured: false }),
      };

      const result = editingId
        ? await supabase
            .from("publications")
            .update(payload)
            .eq("id", editingId)
            .select("id")
        : await supabase
            .from("publications")
            .insert(payload)
            .select("id");

      if (result.error) throw result.error;

      if (!result.data || result.data.length === 0) {
        throw new Error(
          "No publication was saved. Check your admin permissions and RLS policies."
        );
      }

      setMessage(
        editingId
          ? "Publication updated successfully."
          : "Publication added successfully."
      );

      resetForm();
      await loadPublications();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(publication: Publication) {
    if (saving || deletingId) return;

    setMessage("");
    setError("");

    const { data, error: updateError } = await supabase
      .from("publications")
      .update({
        is_published: !publication.is_published,
        // Unpublishing also removes it from the featured carousel.
        ...(publication.is_published ? { is_featured: false } : {}),
      })
      .eq("id", publication.id)
      .select("id, is_published, is_featured");

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (!data || data.length === 0) {
      setError("Status was not changed. Check your admin permissions.");
      return;
    }

    setPublications((current) =>
      current.map((item) =>
        item.id === publication.id
          ? {
              ...item,
              is_published: data[0].is_published,
              is_featured: data[0].is_featured,
            }
          : item
      )
    );

    setMessage(
      data[0].is_published
        ? "Publication published."
        : "Publication unpublished and returned to draft."
    );
  }

  async function toggleFeatured(publication: Publication) {
    if (saving || deletingId) return;

    setMessage("");
    setError("");

    if (!publication.is_featured && !publication.is_published) {
      setError(
        "Publish this paper first. Only published papers can appear in the carousel."
      );
      return;
    }

    const nextFeatured = !publication.is_featured;

    // The database also enforces the limit of 8 featured papers.
    const { data, error: updateError } = await supabase
      .from("publications")
      .update({ is_featured: nextFeatured })
      .eq("id", publication.id)
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

    setPublications((current) =>
      current.map((item) =>
        item.id === publication.id
          ? { ...item, is_featured: data[0].is_featured }
          : item
      )
    );

    setMessage(
      nextFeatured
        ? "Paper added to the Research carousel."
        : "Paper removed from the Research carousel."
    );
  }

  async function updateFeaturedOrder(
    publication: Publication,
    value: string
  ) {
    const order = Number(value);

    if (!value.trim() || !Number.isInteger(order) || order < 0) {
      setError("Carousel position must be a whole number, 0 or higher.");
      return;
    }

    if (order === publication.featured_order) return;

    setMessage("");
    setError("");

    const { data, error: updateError } = await supabase
      .from("publications")
      .update({ featured_order: order })
      .eq("id", publication.id)
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

    setPublications((current) =>
      current.map((item) =>
        item.id === publication.id
          ? { ...item, featured_order: data[0].featured_order }
          : item
      )
    );

    setMessage("Carousel position updated. Lower numbers appear first.");
  }

  async function deletePublication(publication: Publication) {
    if (deletingId || saving) return;

    const confirmed = window.confirm(
      `Delete "${publication.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(publication.id);
    setMessage("");
    setError("");

    try {
      const { data, error: deleteError } = await supabase
        .from("publications")
        .delete()
        .eq("id", publication.id)
        .select("id");

      if (deleteError) throw deleteError;

      if (!data || data.length === 0) {
        throw new Error(
          "No publication was deleted. Check your admin permissions and RLS policies."
        );
      }

      if (editingId === publication.id) resetForm();

      setMessage(
        "Publication deleted. Any files previously uploaded to Storage may still need to be removed separately."
      );

      await loadPublications();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete the publication."
      );
    } finally {
      setDeletingId(null);
    }
  }

  const featuredCount = publications.filter(
    (publication) => publication.is_featured
  ).length;

  const filteredPublications = publications.filter((publication) => {
    const text = [
      publication.title,
      ...(publication.authors ?? []),
      publication.journal ?? "",
      publication.doi ?? "",
      publication.external_url ?? "",
      publication.abstract ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return text.includes(search.trim().toLowerCase());
  });

  return (
    <main className="container-page py-12">
      <header className="mb-10">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted">
          BioCode Innovators
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Manage publications
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Upload research papers, manage publication details, and control
          which papers are visible in the Research Wing.
        </p>
      </header>

      <section className="mb-12 rounded-2xl border border-current/10 p-5 md:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              {editingId ? "Edit publication" : "Add a publication"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Title and at least one author are required. Add an external URL
              or upload a PDF.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setMessage("");
                setError("");
              }}
              disabled={saving}
              className="rounded-lg border border-current/20 px-4 py-2 text-sm hover:bg-current/5 disabled:opacity-50"
            >
              Cancel editing
            </button>
          )}
        </div>

        {message && (
          <p role="status" className="mb-5 rounded-lg border border-green-600/30 p-3 text-sm">
            {message}
          </p>
        )}

        {error && (
          <p role="alert" className="mb-5 break-words rounded-lg border border-red-500/40 p-3 text-sm">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Publication title *
              <input
                required
                maxLength={500}
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
                placeholder="Enter the research title"
              />
            </label>

            <label className="block text-sm font-medium">
              Authors *
              <input
                required
                value={form.authors}
                onChange={(event) => updateField("authors", event.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
                placeholder="Author One, Author Two"
              />
              <span className="mt-1 block text-xs text-muted">
                Separate multiple authors with commas.
              </span>
            </label>

            <label className="block text-sm font-medium">
              Publication year
              <input
                type="number"
                min="1"
                max="9999"
                step="1"
                value={form.year}
                onChange={(event) => updateField("year", event.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
                placeholder="2026"
              />
            </label>

            <label className="block text-sm font-medium">
              Journal or publisher
              <input
                value={form.journal}
                onChange={(event) => updateField("journal", event.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
                placeholder="Journal name"
              />
            </label>

            <label className="block text-sm font-medium">
              DOI
              <input
                value={form.doi}
                onChange={(event) => updateField("doi", event.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
                placeholder="10.xxxx/example"
              />
            </label>
          </div>

          <label className="block text-sm font-medium">
            External publication URL
            <input
              type="url"
              value={form.external_url}
              onChange={(event) => updateField("external_url", event.target.value)}
              className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
              placeholder="https://..."
            />
            <span className="mt-1 block text-xs text-muted">
              Optional if you upload a PDF.
            </span>
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Research paper PDF
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setError("");

                  if (!file) {
                    setPdfFile(null);
                    return;
                  }

                  const validationError = validatePublicationFile(file, "pdf");
                  if (validationError) {
                    setError(validationError);
                    event.target.value = "";
                    setPdfFile(null);
                    return;
                  }

                  setPdfFile(file);
                }}
                className="mt-2 block w-full text-sm"
              />
              <span className="mt-1 block text-xs text-muted">
                PDF only, maximum 20 MB.
              </span>
              {existingPdfUrl && (
                <a
                  href={existingPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block break-all text-xs underline"
                >
                  View current PDF
                </a>
              )}
            </label>

            <label className="block text-sm font-medium">
              Cover image
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setError("");

                  if (!file) {
                    setImageFile(null);
                    return;
                  }

                  const validationError = validatePublicationFile(file, "image");
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
                JPG, PNG, or WebP, maximum 5 MB.
              </span>
              {existingImageUrl && (
                <a
                  href={existingImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block break-all text-xs underline"
                >
                  View current cover image
                </a>
              )}
            </label>
          </div>

          <label className="block text-sm font-medium">
            Abstract / short description
            <textarea
              rows={4}
              value={form.abstract}
              onChange={(event) => updateField("abstract", event.target.value)}
              className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
              placeholder="Briefly describe the research..."
            />
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(event) => setIsPublished(event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Publish this research paper</span>
              <span className="mt-1 block text-muted">
                Unchecked records are drafts and should not appear on the public
                Research page.
              </span>
            </span>
          </label>

          <button
            type="submit"
            disabled={saving || deletingId !== null}
            className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Saving and uploading..."
              : editingId
                ? "Save changes"
                : "Add publication"}
          </button>
        </form>
      </section>

      <section>
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold">Research publications</h2>
            <p className="mt-1 text-sm text-muted">
              {publications.length}{" "}
              {publications.length === 1 ? "publication" : "publications"} in
              your database
            </p>
            <p className="mt-1 text-sm text-muted">
              Featured in the carousel: {featuredCount} / {MAX_FEATURED}. Only
              published papers can be featured.
            </p>
          </div>

          <label className="block text-sm">
            Search publications
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 sm:w-72"
              placeholder="Search title, author, DOI..."
            />
          </label>
        </div>

        {loading ? (
          <p className="py-10 text-muted">Loading publications...</p>
        ) : filteredPublications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-current/20 p-8 text-center">
            <p className="font-medium">No publications found.</p>
            <p className="mt-2 text-sm text-muted">
              Add a publication above or try a different search.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPublications.map((publication) => (
              <article
                key={publication.id}
                className="rounded-xl border border-current/10 p-5 md:p-6"
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        {publication.title}
                      </h3>
                      <span className="rounded-full border border-current/15 px-2.5 py-1 text-xs">
                        {publication.is_published ? "Published" : "Draft"}
                      </span>
                      {publication.is_featured && (
                        <span className="rounded-full border border-current/15 px-2.5 py-1 text-xs">
                          ★ In carousel
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-muted">
                      {(publication.authors ?? []).join(", ")}
                    </p>

                    <p className="mt-2 text-sm">
                      {[publication.journal, publication.year]
                        .filter((value) => value !== null && value !== undefined)
                        .join(" · ") || "Journal and year not provided"}
                    </p>

                    {publication.doi && (
                      <p className="mt-1 break-all text-sm text-muted">
                        DOI: {publication.doi}
                      </p>
                    )}

                    {publication.abstract && (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
                        {publication.abstract}
                      </p>
                    )}

                    {publication.pdf_url && (
                      <a
                        href={publication.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 mr-4 inline-block break-all text-sm underline underline-offset-4"
                      >
                        Open PDF
                      </a>
                    )}

                    <a
                      href={publication.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-block break-all text-sm underline underline-offset-4"
                    >
                      Open publication link
                    </a>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
                    <button
                      type="button"
                      onClick={() => startEditing(publication)}
                      disabled={saving || deletingId !== null}
                      className="rounded-lg border border-current/20 px-4 py-2 text-sm hover:bg-current/5 disabled:opacity-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => void togglePublished(publication)}
                      disabled={saving || deletingId !== null}
                      className="rounded-lg border border-current/20 px-4 py-2 text-sm hover:bg-current/5 disabled:opacity-50"
                    >
                      {publication.is_published ? "Unpublish" : "Publish"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void toggleFeatured(publication)}
                      disabled={saving || deletingId !== null}
                      aria-pressed={publication.is_featured}
                      className="rounded-lg border border-current/20 px-4 py-2 text-sm hover:bg-current/5 disabled:opacity-50"
                    >
                      {publication.is_featured
                        ? "★ Remove from carousel"
                        : "☆ Add to carousel"}
                    </button>

                    {publication.is_featured && (
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-muted">Position</span>
                        <input
                          key={`${publication.id}-${publication.featured_order}`}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={publication.featured_order}
                          onBlur={(event) =>
                            void updateFeaturedOrder(
                              publication,
                              event.target.value
                            )
                          }
                          className="w-20 rounded-lg border border-current/20 bg-transparent px-2 py-2"
                        />
                      </label>
                    )}

                    <button
                      type="button"
                      onClick={() => void deletePublication(publication)}
                      disabled={deletingId !== null || saving}
                      className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-600 hover:bg-red-500/5 disabled:opacity-50"
                    >
                      {deletingId === publication.id ? "Deleting..." : "Delete"}
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
