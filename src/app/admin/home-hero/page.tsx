"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/client";

const BUCKET = "research-journal-assets";
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function AdminHomeHeroPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/admin/home-hero", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? "Could not load hero settings.");
        }

        if (active) {
          setImageUrl(result.imageUrl ?? "");
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load homepage hero settings."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  function handleFileChange(file: File | null) {
    setMessage("");
    setError("");

    if (!file) {
      setImageFile(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      setImageFile(null);
      return;
    }

    if (file.size > MAX_SIZE) {
      setError("The image must be no larger than 5 MB.");
      setImageFile(null);
      return;
    }

    setImageFile(file);
  }

  async function handleSave() {
    if (saving || !imageFile) return;

    setSaving(true);
    setMessage("");
    setError("");

    let uploadedPath = "";

    try {
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9.-]/g, "-");
      uploadedPath = `home-hero/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(uploadedPath, imageFile, {
          upsert: false,
          contentType: imageFile.type,
        });

      if (uploadError) {
        throw new Error(`Image upload failed: ${uploadError.message}`);
      }

      const uploadedUrl = supabase.storage
        .from(BUCKET)
        .getPublicUrl(uploadedPath).data.publicUrl;

      const response = await fetch("/api/admin/home-hero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: uploadedUrl,
          storagePath: uploadedPath,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error ?? "Could not save homepage hero.");
      }

      setImageUrl(uploadedUrl);
      setImageFile(null);
      setMessage("Homepage hero image saved successfully.");
    } catch (err) {
      if (uploadedPath) {
        await supabase.storage.from(BUCKET).remove([uploadedPath]);
      }

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while saving."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (removing || !imageUrl) return;

    const confirmed = window.confirm(
      "Remove the homepage hero image? The coded DNA illustration will appear again."
    );

    if (!confirmed) return;

    setRemoving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/home-hero", {
        method: "DELETE",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error ?? "Could not remove hero image.");
      }

      setImageUrl("");
      setImageFile(null);
      setMessage("Hero image removed. The coded illustration is restored.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not remove the homepage hero image."
      );
    } finally {
      setRemoving(false);
    }
  }

  const displayedImage = previewUrl || imageUrl;

  return (
    <main className="container-page py-12">
      <header className="mb-8">
        <Link
          href="/admin"
          className="text-sm text-muted underline underline-offset-4 hover:text-primary"
        >
          ← Back to admin dashboard
        </Link>

        <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-primary">
          Website settings
        </p>

        <h1 className="mt-2 text-3xl font-semibold text-secondary">
          Homepage Hero
        </h1>

        <p className="mt-3 max-w-2xl text-muted">
          Upload the main visual displayed on the right side of the homepage
          hero. Your heading, buttons and other homepage content will remain
          unchanged.
        </p>
      </header>

      {loading ? (
        <p className="text-muted">Loading current homepage settings...</p>
      ) : (
        <section className="max-w-3xl space-y-6 rounded-2xl border border-line bg-bg p-6 sm:p-8">
          <div>
            <h2 className="text-lg font-semibold text-secondary">
              Hero image preview
            </h2>

            <p className="mt-1 text-sm text-muted">
              Recommended: a high-quality landscape or square image. JPG,
              PNG or WebP, maximum 5 MB.
            </p>

            <div className="mt-5 flex min-h-64 items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface">
              {displayedImage ? (
                <img
                  src={displayedImage}
                  alt="Homepage hero preview"
                  className="aspect-square max-h-[520px] w-full object-cover"
                />
              ) : (
                <div className="px-6 py-16 text-center">
                  <p className="font-semibold text-secondary">
                    Default DNA illustration is active
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Upload an image to replace the coded visual on the
                    homepage.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="home-hero-image"
              className="block text-sm font-semibold text-secondary"
            >
              Select homepage image
            </label>

            <input
              id="home-hero-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-3 block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-secondary file:px-4 file:py-2.5 file:font-semibold file:text-white hover:file:opacity-90"
              onChange={(event) => {
                handleFileChange(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />

            {imageFile && (
              <p className="mt-2 text-sm text-muted">
                Selected: {imageFile.name}
              </p>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {message && (
            <p
              role="status"
              className="rounded-lg bg-surface p-3 text-sm text-primary"
            >
              {message}
            </p>
          )}

          <div className="flex flex-wrap gap-3 border-t border-line pt-5">
            <button
              type="button"
              onClick={handleSave}
              disabled={!imageFile || saving || removing}
              className="rounded-lg bg-secondary px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Uploading and saving..." : "Save homepage image"}
            </button>

            {imageUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={saving || removing}
                className="rounded-lg border border-red-300 px-6 py-3 font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
              >
                {removing ? "Removing..." : "Remove image"}
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
