
"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Profile = {
  full_name: string;
  country: string | null;
  institution: string | null;
  photo_url: string | null;
};

export default function ProfileForm({
  userId,
  email,
  createdAt,
}: {
  userId: string;
  email: string;
  createdAt: string;
}) {
  const [profile, setProfile] = useState<Profile>({
    full_name: "",
    country: "",
    institution: "",
    photo_url: null,
  });

  const [photoPreview, setPhotoPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supabase = createBrowserSupabase();

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user || authData.user.id !== userId) {
        if (active) {
          setError("Your session could not be verified. Please log in again.");
          setLoading(false);
        }
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("full_name, country, institution, photo_url")
        .eq("id", userId)
        .single();

      if (!active) return;

      if (fetchError || !data) {
        setError("We could not load your profile. Please refresh the page.");
        setLoading(false);
        return;
      }

      setProfile(data);

      if (data.photo_url) {
        const { data: signed } = await supabase.storage
          .from("student-avatars")
          .createSignedUrl(data.photo_url, 3600);

        if (active && signed?.signedUrl) {
          setPhotoPreview(signed.signedUrl);
        }
      }

      if (active) setLoading(false);
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [userId]);

  async function uploadPhoto(file?: File) {
    if (!file) return;

    setError("");
    setMessage("");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Your image must be smaller than 5 MB.");
      return;
    }

    setUploading(true);

    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";

    const oldPath = profile.photo_url;
    const newPath = `${userId}/avatar-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("student-avatars")
      .upload(newPath, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      setError("Photo upload failed. Please try again.");
      setUploading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ photo_url: newPath })
      .eq("id", userId);

    if (updateError) {
      await supabase.storage.from("student-avatars").remove([newPath]);
      setError("Your photo could not be saved to your profile.");
      setUploading(false);
      return;
    }

    const { data: signed } = await supabase.storage
      .from("student-avatars")
      .createSignedUrl(newPath, 3600);

    setProfile((previous) => ({
      ...previous,
      photo_url: newPath,
    }));

    if (signed?.signedUrl) {
      setPhotoPreview(signed.signedUrl);
    }

    if (oldPath && oldPath.startsWith(`${userId}/`)) {
      await supabase.storage.from("student-avatars").remove([oldPath]);
    }

    setMessage("Profile photo updated successfully.");
    setUploading(false);
  }

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setBusy(true);
    setError("");
    setMessage("");

    const form = new FormData(e.currentTarget);
    const fullName = String(form.get("full_name") ?? "").trim();
    const country = String(form.get("country") ?? "").trim();
    const institution = String(form.get("institution") ?? "").trim();

    if (fullName.length < 2) {
      setError("Please enter your full name.");
      setBusy(false);
      return;
    }

    const { error: saveError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        country: country || null,
        institution: institution || null,
      })
      .eq("id", userId);

    if (saveError) {
      setError("We could not save your changes. Please try again.");
      setBusy(false);
      return;
    }

    setProfile((previous) => ({
      ...previous,
      full_name: fullName,
      country,
      institution,
    }));

    setMessage("Your profile has been updated.");
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-line p-8 text-center text-muted">
        Loading your profile...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-bg shadow-sm">
      <div className="border-b border-line bg-surface/60 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface text-3xl font-semibold text-primary">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Your profile"
                className="h-full w-full object-cover"
              />
            ) : (
              profile.full_name?.charAt(0)?.toUpperCase() || "S"
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold">
              {profile.full_name || "Your profile"}
            </h2>
            <p className="mt-1 text-sm text-muted">{email}</p>

            <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg border border-line bg-bg px-4 py-2 text-sm font-semibold transition hover:border-primary">
              {uploading ? "Uploading..." : "Change photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  void uploadPhoto(e.target.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <p className="mt-2 text-xs text-muted">
              JPG, PNG or WebP. Maximum 5 MB.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={saveProfile} className="space-y-6 p-6 sm:p-8">
        <div>
          <label htmlFor="full_name" className="mb-2 block text-sm font-semibold">
            Full name
          </label>
          <input
            id="full_name"
            name="full_name"
            required
            minLength={2}
            value={profile.full_name}
onChange={(e) =>
  setProfile((p) => ({ ...p, full_name: e.target.value }))
}
            className="field"
          />
          <p className="mt-1 text-xs text-muted">
            Use the name you want displayed on your certificates.
          </p>
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-semibold">
            Email address
          </label>
          <input
            id="email"
            value={email}
            readOnly
            className="field cursor-not-allowed opacity-70"
          />
          <p className="mt-1 text-xs text-muted">
            Your account email is managed through authentication.
          </p>
        </div>

        <div>
          <label htmlFor="country" className="mb-2 block text-sm font-semibold">
            Country
          </label>
          <input
            id="country"
            name="country"
            value={profile.country ?? ""}
onChange={(e) =>
  setProfile((p) => ({ ...p, country: e.target.value }))
}
            placeholder="Your country"
            className="field"
          />
        </div>

        <div>
          <label htmlFor="institution" className="mb-2 block text-sm font-semibold">
            Institution
          </label>
          <input
            id="institution"
            name="institution"
            value={profile.institution ?? ""}
onChange={(e) =>
  setProfile((p) => ({ ...p, institution: e.target.value }))
}
            placeholder="University or institution"
            className="field"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Member since</p>
          <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
            {new Date(createdAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="text-sm text-success">
            {message}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button className="btn" disabled={busy || uploading}>
            {busy ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
