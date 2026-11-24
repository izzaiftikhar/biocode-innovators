
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Update = {
  id: string;
  title: string;
  content: string;
  external_url: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
};

type UpdateForm = {
  title: string;
  content: string;
  external_url: string;
  published: boolean;
};

const emptyForm: UpdateForm = {
  title: "",
  content: "",
  external_url: "",
  published: false,
};

export default function UpdatesAdmin() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [updates, setUpdates] = useState<Update[]>([]);
  const [form, setForm] = useState<UpdateForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadUpdates = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("updates")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setUpdates([]);
    } else {
      setUpdates((data ?? []) as Update[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadUpdates();
  }, [loadUpdates]);

  function updateField<K extends keyof UpdateForm>(
    field: K,
    value: UpdateForm[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setMessage("");
    setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    const title = form.title.trim();
    const content = form.content.trim();
    const externalUrl = form.external_url.trim();

    if (!title || !content) {
      setError("Please enter both a title and announcement content.");
      setSaving(false);
      return;
    }

    if (externalUrl) {
      try {
        const url = new URL(externalUrl);

        if (url.protocol !== "https:" && url.protocol !== "http:") {
          throw new Error("Invalid protocol");
        }
      } catch {
        setError("Enter a valid link starting with https:// or http://.");
        setSaving(false);
        return;
      }
    }

    const payload = {
      title,
      content,
      external_url: externalUrl || null,
      published: form.published,
      updated_at: new Date().toISOString(),
    };

    try {
      const result = editingId
        ? await supabase
            .from("updates")
            .update(payload)
            .eq("id", editingId)
        : await supabase.from("updates").insert(payload);

      if (result.error) {
        setError(result.error.message);
        return;
      }

      setMessage(
        editingId
          ? "Announcement updated successfully."
          : form.published
            ? "Announcement published successfully."
            : "Announcement saved as a draft."
      );

      resetForm();
      await loadUpdates();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(update: Update) {
    setEditingId(update.id);
    setForm({
      title: update.title,
      content: update.content,
      external_url: update.external_url ?? "",
      published: update.published,
    });
    setMessage("");
    setError("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteUpdate(update: Update) {
    const confirmed = window.confirm(
      `Delete "${update.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setMessage("");
    setError("");

    const { error: deleteError } = await supabase
      .from("updates")
      .delete()
      .eq("id", update.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingId === update.id) {
      resetForm();
    }

    setMessage("Announcement deleted successfully.");
    await loadUpdates();
  }

  const filteredUpdates = updates.filter((update) =>
    `${update.title} ${update.content}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <main className="container-page py-12">
      <header className="mb-10">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted">
          BioCode Innovators
        </p>

        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Updates & Announcements
        </h1>

        <p className="mt-3 max-w-2xl text-muted">
          Create announcements, share resources, and keep the Research Wing
          community informed.
        </p>
      </header>

      {message && (
        <p className="mb-6 rounded-lg border border-green-600/30 p-4 text-green-700">
          {message}
        </p>
      )}

      {error && (
        <p role="alert" className="mb-6 rounded-lg border border-red-600/30 p-4 text-red-600">
          {error}
        </p>
      )}

      <section className="mb-12 rounded-2xl border border-border p-6">
        <h2 className="mb-6 text-xl font-semibold">
          {editingId ? "Edit announcement" : "Create an announcement"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="title" className="mb-2 block text-sm font-medium">
              Announcement title *
            </label>
            <input
              id="title"
              required
              maxLength={200}
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="e.g. Upcoming Bioinformatics Workshop"
              className="w-full rounded-lg border border-border bg-transparent px-4 py-3"
            />
          </div>

          <div>
            <label htmlFor="content" className="mb-2 block text-sm font-medium">
              Announcement content *
            </label>
            <textarea
              id="content"
              required
              rows={6}
              value={form.content}
              onChange={(event) => updateField("content", event.target.value)}
              placeholder="Write your announcement..."
              className="w-full rounded-lg border border-border bg-transparent px-4 py-3"
            />
          </div>

          <div>
            <label htmlFor="external_url" className="mb-2 block text-sm font-medium">
              External link (optional)
            </label>
            <input
              id="external_url"
              type="url"
              value={form.external_url}
              onChange={(event) =>
                updateField("external_url", event.target.value)
              }
              placeholder="https://example.com/register"
              className="w-full rounded-lg border border-border bg-transparent px-4 py-3"
            />
          </div>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(event) =>
                updateField("published", event.target.checked)
              }
              className="mt-1"
            />
            <span>
              <span className="block font-medium">Publish immediately</span>
              <span className="text-sm text-muted">
                Leave unchecked to save this announcement as a draft.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-foreground px-5 py-3 text-background disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save changes"
                  : form.published
                    ? "Publish announcement"
                    : "Save draft"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-border px-5 py-3"
              >
                Cancel editing
              </button>
            )}
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Manage announcements</h2>

        <p className="mb-4 text-sm text-muted">
          {updates.length} announcements in your database
        </p>

        <label htmlFor="search" className="mb-2 block text-sm font-medium">
          Search announcements
        </label>
        <input
          id="search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title or content..."
          className="mb-6 w-full rounded-lg border border-border bg-transparent px-4 py-3"
        />

        {loading ? (
          <p className="text-muted">Loading announcements...</p>
        ) : filteredUpdates.length === 0 ? (
          <p className="text-muted">
            No announcements found. Create one above or try a different search.
          </p>
        ) : (
          <div className="space-y-4">
            {filteredUpdates.map((update) => (
              <article
                key={update.id}
                className="rounded-xl border border-border p-5"
              >
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-semibold">{update.title}</h3>
                  <span className="rounded-full border border-border px-3 py-1 text-xs">
                    {update.published ? "Published" : "Draft"}
                  </span>
                </div>

                <p className="whitespace-pre-wrap text-muted">
                  {update.content}
                </p>

                {update.external_url && (
                  <p className="mt-3">
                    <a
                      href={update.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      Open external link
                    </a>
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => startEditing(update)}
                    className="rounded-lg border border-border px-4 py-2"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => void deleteUpdate(update)}
                    className="rounded-lg border border-red-600/40 px-4 py-2 text-red-600"
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
