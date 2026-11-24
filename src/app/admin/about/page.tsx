
"use client";

import { useEffect, useMemo, useState } from "react";
import { about } from "@/data/content";
import { createBrowserSupabase } from "@/lib/supabase/client";

const BUCKET = "research-journal-assets";
const DEFAULT_BADGE = "Advanced Computational & Research Hub";

export default function AdminAboutPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [imageUrl, setImageUrl] = useState("");
  const [badge, setBadge] = useState(DEFAULT_BADGE);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      setLoading(true);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("about_page_settings")
        .select("image_url, badge")
        .eq("id", 1)
        .maybeSingle();

      if (!active) return;

      if (fetchError) {
        setError(`Could not load settings: ${fetchError.message}`);
      } else {
        setImageUrl(data?.image_url ?? "");
        setBadge(data?.badge ?? about.badge ?? DEFAULT_BADGE);
      }

      setLoading(false);
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!badge.trim() || badge.trim().length > 150) {
        throw new Error("Enter a badge between 1 and 150 characters.");
      }

      let finalImageUrl = imageUrl;

      if (imageFile) {
        const safeName = imageFile.name.replace(
          /[^a-zA-Z0-9.-]/g,
          "-"
        );
        const filePath =
          `about/hero/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, imageFile, {
            upsert: false,
            contentType: imageFile.type,
          });

        if (uploadError) {
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }

        finalImageUrl = supabase.storage
          .from(BUCKET)
          .getPublicUrl(filePath).data.publicUrl;
      }

      if (!finalImageUrl) {
        throw new Error("Please choose a hero image before saving.");
      }

      const response = await fetch("/api/admin/about-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: finalImageUrl,
          badge: badge.trim(),
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ?? "Could not save About page settings."
        );
      }

      setImageUrl(finalImageUrl);
      setImageFile(null);
      setMessage("About page settings saved successfully.");
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

  return (
    <main className="container-page py-12">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          Website settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-secondary">
          About Page Settings
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Change the About page hero image and its badge. The founder
          portrait and other About page content will remain unchanged.
        </p>
      </header>

      {loading ? (
        <p className="text-muted">Loading current settings...</p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl space-y-7 rounded-2xl border border-line bg-bg p-6 sm:p-8"
        >
          <section>
            <h2 className="text-lg font-semibold">Hero image</h2>
            <p className="mt-1 text-sm text-muted">
              Choose a JPG, PNG, or WebP image up to 5 MB.
            </p>

            <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
              <img
                src={previewUrl || imageUrl || about.image}
                alt="About page hero preview"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>

            <label className="mt-4 block text-sm font-medium">
              Select replacement image
              <input
                className="mt-2 block w-full text-sm"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setMessage("");
                  setError("");

                  if (!file) {
                    setImageFile(null);
                    return;
                  }

                  if (
                    ![
                      "image/jpeg",
                      "image/png",
                      "image/webp",
                    ].includes(file.type)
                  ) {
                    setError("Choose a JPG, PNG, or WebP image.");
                    event.target.value = "";
                    setImageFile(null);
                    return;
                  }

                  if (file.size > 5 * 1024 * 1024) {
                    setError("The image must be no larger than 5 MB.");
                    event.target.value = "";
                    setImageFile(null);
                    return;
                  }

                  setImageFile(file);
                }}
              />
            </label>

            {imageFile && (
              <p className="mt-2 text-sm text-muted">
                Selected: {imageFile.name}
              </p>
            )}
          </section>

          <section>
            <label
              htmlFor="about-badge"
              className="block text-sm font-semibold"
            >
              Hero image badge
            </label>
            <input
              id="about-badge"
              type="text"
              required
              maxLength={150}
              value={badge}
              onChange={(event) => setBadge(event.target.value)}
              className="mt-2 w-full rounded-lg border border-line bg-surface px-4 py-3 text-secondary"
              placeholder="Advanced Computational & Research Hub"
            />
            <p className="mt-1 text-xs text-muted">
              {badge.length}/150 characters
            </p>
          </section>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {message && (
            <p role="status" className="rounded-lg bg-surface p-3 text-sm text-primary">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-secondary px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Uploading and saving..." : "Save About Settings"}
          </button>
        </form>
      )}
    </main>
  );
}
