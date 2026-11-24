
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

type CarouselSlide = {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  link_url: string | null;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type CarouselForm = {
  title: string;
  description: string;
  link_url: string;
  display_order: string;
};

const BUCKET = "research-journal-assets";

const emptyForm: CarouselForm = {
  title: "",
  description: "",
  link_url: "",
  display_order: "0",
};

function validateImage(file: File): string | null {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  ) {
    return "Please select a JPG, PNG, or WebP image.";
  }

  if (file.size > 5 * 1024 * 1024) {
    return "The image must be no larger than 5 MB.";
  }

  return null;
}

async function uploadCarouselImage(
  supabase: ReturnType<typeof createBrowserSupabase>,
  file: File
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
  const filePath = `carousel/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }

  return supabase.storage.from(BUCKET).getPublicUrl(filePath).data
    .publicUrl;
}

function validateHttpUrl(value: string): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "Links must use HTTP or HTTPS.";
    }
  } catch {
    return "Please enter a valid URL beginning with https:// or http://.";
  }

  return null;
}

export default function AdminCarouselPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [form, setForm] = useState<CarouselForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(
    null
  );
  const [isPublished, setIsPublished] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSlides = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchError } = await supabase
        .from("homepage_carousel")
        .select(
          "id, title, description, image_url, link_url, display_order, is_published, created_at, updated_at"
        )
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      setSlides((data ?? []) as CarouselSlide[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load carousel slides."
      );
      setSlides([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadSlides();
  }, [loadSlides]);

  function updateField(field: keyof CarouselForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setImageFile(null);
    setExistingImageUrl(null);
    setIsPublished(false);
  }

  function startEditing(slide: CarouselSlide) {
    setEditingId(slide.id);

    setForm({
      title: slide.title,
      description: slide.description ?? "",
      link_url: slide.link_url ?? "",
      display_order: String(slide.display_order),
    });

    setExistingImageUrl(slide.image_url);
    setImageFile(null);
    setIsPublished(slide.is_published);
    setMessage("");
    setError("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || deletingId) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const title = form.title.trim();
      const description = form.description.trim();
      const linkUrl = form.link_url.trim();
      const orderText = form.display_order.trim();
      const displayOrder = Number(orderText);

      if (!title) {
        throw new Error("Please enter a slide title.");
      }

      if (
        !orderText ||
        !Number.isInteger(displayOrder) ||
        displayOrder < 0
      ) {
        throw new Error(
          "Display order must be a non-negative whole number."
        );
      }

      const urlError = validateHttpUrl(linkUrl);
      if (urlError) throw new Error(urlError);

      if (!editingId && !imageFile) {
        throw new Error("Please select an image for this slide.");
      }

      if (!imageFile && !existingImageUrl) {
        throw new Error("This slide needs an image.");
      }

      // Upload a replacement image only when a new file is selected.
      const imageUrl = imageFile
        ? await uploadCarouselImage(supabase, imageFile)
        : existingImageUrl;

      if (!imageUrl) {
        throw new Error("The slide image URL is missing.");
      }

      const payload = {
        title,
        description: description || null,
        image_url: imageUrl,
        link_url: linkUrl || null,
        display_order: displayOrder,
        is_published: isPublished,
        updated_at: new Date().toISOString(),
      };

      const result = editingId
        ? await supabase
            .from("homepage_carousel")
            .update(payload)
            .eq("id", editingId)
            .select("id")
        : await supabase
            .from("homepage_carousel")
            .insert(payload)
            .select("id");

      if (result.error) throw result.error;

      if (!result.data || result.data.length === 0) {
        throw new Error(
          "Nothing was saved. Check your admin permissions and RLS policies."
        );
      }

      setMessage(
        editingId
          ? "Carousel slide updated successfully."
          : "Carousel slide added successfully."
      );

      resetForm();
      await loadSlides();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save the carousel slide."
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(slide: CarouselSlide) {
    if (saving || deletingId) return;

    setMessage("");
    setError("");

    const { data, error: updateError } = await supabase
      .from("homepage_carousel")
      .update({
        is_published: !slide.is_published,
        updated_at: new Date().toISOString(),
      })
      .eq("id", slide.id)
      .select("id, is_published");

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (!data || data.length === 0) {
      setError(
        "The status was not changed. Check your admin permissions."
      );
      return;
    }

    setSlides((current) =>
      current.map((item) =>
        item.id === slide.id
          ? { ...item, is_published: data[0].is_published }
          : item
      )
    );

    setMessage(
      data[0].is_published
        ? "Slide published."
        : "Slide unpublished and returned to draft."
    );
  }

  async function deleteSlide(slide: CarouselSlide) {
    if (deletingId || saving) return;

    const confirmed = window.confirm(
      `Delete the carousel slide "${slide.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(slide.id);
    setMessage("");
    setError("");

    try {
      const { data, error: deleteError } = await supabase
        .from("homepage_carousel")
        .delete()
        .eq("id", slide.id)
        .select("id");

      if (deleteError) throw deleteError;

      if (!data || data.length === 0) {
        throw new Error(
          "Nothing was deleted. Check your admin permissions and RLS policies."
        );
      }

      if (editingId === slide.id) resetForm();

      setMessage(
        "Slide deleted. Its uploaded image remains in Storage and can be removed separately."
      );

      await loadSlides();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete the slide."
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredSlides = slides.filter((slide) =>
    [
      slide.title,
      slide.description ?? "",
      slide.link_url ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  return (
    <main className="container-page py-12">
      <header className="mb-10">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted">
          BioCode Innovators
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Manage homepage carousel
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Upload slide images, manage descriptions and links, choose their
          order, and control which slides appear on the homepage.
        </p>
      </header>

      <section className="mb-12 rounded-2xl border border-current/10 p-5 md:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              {editingId ? "Edit slide" : "Add a slide"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              A title and image are required. Description and destination
              link are optional.
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
          <p
            role="status"
            className="mb-5 break-words rounded-lg border border-green-600/30 p-3 text-sm"
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
          <label className="block text-sm font-medium">
            Slide title *
            <input
              required
              maxLength={300}
              value={form.title}
              onChange={(event) =>
                updateField("title", event.target.value)
              }
              className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
              placeholder="Enter a slide title"
            />
          </label>

          <label className="block text-sm font-medium">
            Description
            <textarea
              rows={3}
              maxLength={2000}
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
              placeholder="A short description for this slide"
            />
          </label>

          <label className="block text-sm font-medium">
            Destination URL
            <input
              type="url"
              value={form.link_url}
              onChange={(event) =>
                updateField("link_url", event.target.value)
              }
              className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
              placeholder="https://... or an internal page URL"
            />
            <span className="mt-1 block text-xs text-muted">
              Optional. Use a full HTTP or HTTPS URL, or leave blank.
            </span>
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Display order *
              <input
                type="number"
                required
                min="0"
                step="1"
                value={form.display_order}
                onChange={(event) =>
                  updateField("display_order", event.target.value)
                }
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
              />
              <span className="mt-1 block text-xs text-muted">
                Lower numbers appear earlier in the carousel.
              </span>
            </label>

            <label className="block text-sm font-medium">
              Slide image *
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
          </div>

          {existingImageUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Current image</p>
              <img
                src={existingImageUrl}
                alt="Current carousel slide"
                className="h-40 w-full rounded-xl border border-current/10 object-cover md:w-72"
              />
              <p className="break-all text-xs text-muted">
                Select a new image above to replace this one.
              </p>
            </div>
          )}

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(event) =>
                setIsPublished(event.target.checked)
              }
              className="mt-1"
            />
            <span>
              <span className="font-medium">Publish this slide</span>
              <span className="mt-1 block text-muted">
                Unpublished slides are drafts and will be excluded from
                the public carousel.
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
                : "Add slide"}
          </button>
        </form>
      </section>

      <section>
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold">Carousel slides</h2>
            <p className="mt-1 text-sm text-muted">
              {slides.length}{" "}
              {slides.length === 1 ? "slide" : "slides"} in your database
            </p>
          </div>

          <label className="block text-sm">
            Search slides
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 sm:w-72"
              placeholder="Search title or description..."
            />
          </label>
        </div>

        {loading ? (
          <p className="py-10 text-muted">Loading carousel slides...</p>
        ) : filteredSlides.length === 0 ? (
          <div className="rounded-xl border border-dashed border-current/20 p-8 text-center">
            <p className="font-medium">No slides found.</p>
            <p className="mt-2 text-sm text-muted">
              Add a slide above or try a different search.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSlides.map((slide) => (
              <article
                key={slide.id}
                className="rounded-xl border border-current/10 p-5 md:p-6"
              >
                <div className="flex flex-col gap-5 md:flex-row">
                  <img
                    src={slide.image_url}
                    alt={slide.title}
                    className="h-44 w-full rounded-xl border border-current/10 object-cover md:w-64"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        {slide.title}
                      </h3>
                      <span className="rounded-full border border-current/15 px-2.5 py-1 text-xs">
                        {slide.is_published ? "Published" : "Draft"}
                      </span>
                      <span className="rounded-full border border-current/15 px-2.5 py-1 text-xs">
                        Order: {slide.display_order}
                      </span>
                    </div>

                    {slide.description && (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
                        {slide.description}
                      </p>
                    )}

                    {slide.link_url && (
                      <a
                        href={slide.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block break-all text-sm underline underline-offset-4"
                      >
                        Open destination link
                      </a>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(slide)}
                        disabled={saving || deletingId !== null}
                        className="rounded-lg border border-current/20 px-4 py-2 text-sm hover:bg-current/5 disabled:opacity-50"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => void togglePublished(slide)}
                        disabled={saving || deletingId !== null}
                        className="rounded-lg border border-current/20 px-4 py-2 text-sm hover:bg-current/5 disabled:opacity-50"
                      >
                        {slide.is_published ? "Unpublish" : "Publish"}
                      </button>

                      <button
                        type="button"
                        onClick={() => void deleteSlide(slide)}
                        disabled={deletingId !== null || saving}
                        className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-600 hover:bg-red-500/5 disabled:opacity-50"
                      >
                        {deletingId === slide.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
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
