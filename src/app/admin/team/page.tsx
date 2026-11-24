"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

type TeamMember = {
  id: string;
  name: string;
  role: string;
  bio: string;
  display_order: number;
  is_published: boolean;
};

type TeamMemberForm = {
  name: string;
  role: string;
  bio: string;
  display_order: number;
  is_published: boolean;
};

const emptyForm: TeamMemberForm = {
  name: "",
  role: "",
  bio: "",
  display_order: 1,
  is_published: true,
};

export default function TeamAdmin() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [form, setForm] = useState<TeamMemberForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");


  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("about_team_members")
      .select("id, name, role, bio, display_order, is_published")
      .order("display_order", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setMembers([]);
    } else {
      setMembers((data ?? []) as TeamMember[]);
    }

    setLoading(false);
  }, [supabase]);


  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);


  function updateField<K extends keyof TeamMemberForm>(
    field: K,
    value: TeamMemberForm[K]
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

    const name = form.name.trim();
    const role = form.role.trim();
    const bio = form.bio.trim();

    if (!name || !role) {
      setError("Please enter both a member name and role.");
      setSaving(false);
      return;
    }

    const payload = {
      name,
      role,
      bio,
      display_order: form.display_order,
      is_published: form.is_published,
      updated_at: new Date().toISOString(),
    };

    try {
      const result = editingId
        ? await supabase
            .from("about_team_members")
            .update(payload)
            .eq("id", editingId)
        : await supabase
            .from("about_team_members")
            .insert(payload);

      if (result.error) {
        setError(result.error.message);
        return;
      }

      setMessage(
        editingId
          ? "Team member updated successfully."
          : "Team member added successfully."
      );

      resetForm();
      await loadMembers();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }


  function startEditing(member: TeamMember) {
    setEditingId(member.id);

    setForm({
      name: member.name,
      role: member.role,
      bio: member.bio,
      display_order: member.display_order,
      is_published: member.is_published,
    });

    setMessage("");
    setError("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }


  async function deleteMember(member: TeamMember) {
    const confirmed = window.confirm(
      `Delete "${member.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setMessage("");
    setError("");

    const { error: deleteError } = await supabase
      .from("about_team_members")
      .delete()
      .eq("id", member.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingId === member.id) {
      resetForm();
    }

    setMessage("Team member deleted successfully.");
    await loadMembers();
  }


  const filteredMembers = members.filter((member) =>
    `${member.name} ${member.role} ${member.bio}`
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
          Core Team & Guidance
        </h1>

        <p className="mt-3 max-w-2xl text-muted">
          Add, edit, publish, and remove the team members displayed on the About page.
        </p>
      </header>


      {message && (
        <p className="mb-6 rounded-lg border border-green-600/30 p-4 text-green-700">
          {message}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-red-600/30 p-4 text-red-600"
        >
          {error}
        </p>
      )}

      <section className="mb-12 rounded-2xl border border-border p-6">
        <h2 className="mb-6 text-xl font-semibold">
          {editingId ? "Edit team member" : "Add a team member"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-medium">
              Member name *
            </label>
            <input
              id="name"
              required
              maxLength={150}
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Enter the member's full name"
              className="w-full rounded-lg border border-border bg-transparent px-4 py-3"
            />
          </div>

          <div>
            <label htmlFor="role" className="mb-2 block text-sm font-medium">
              Role *
            </label>
            <input
              id="role"
              required
              maxLength={150}
              value={form.role}
              onChange={(event) => updateField("role", event.target.value)}
              placeholder="e.g. Research Lead or Mentor"
              className="w-full rounded-lg border border-border bg-transparent px-4 py-3"
            />
          </div>

          <div>
            <label htmlFor="bio" className="mb-2 block text-sm font-medium">
              Short bio
            </label>
            <textarea
              id="bio"
              rows={4}
              maxLength={2000}
              value={form.bio}
              onChange={(event) => updateField("bio", event.target.value)}
              placeholder="Add the member's introduction or background"
              className="w-full rounded-lg border border-border bg-transparent px-4 py-3"
            />
          </div>

          <div>
            <label
              htmlFor="display_order"
              className="mb-2 block text-sm font-medium"
            >
              Display order
            </label>
            <input
              id="display_order"
              type="number"
              min={0}
              required
              value={form.display_order}
              onChange={(event) =>
                updateField("display_order", Number(event.target.value))
              }
              className="w-full rounded-lg border border-border bg-transparent px-4 py-3"
            />
          </div>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(event) =>
                updateField("is_published", event.target.checked)
              }
              className="mt-1"
            />
            <span>
              <span className="block font-medium">Publish member</span>
              <span className="text-sm text-muted">
                Uncheck this to keep the member hidden from the public About page.
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
                  : "Add team member"}
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
        <h2 className="mb-4 text-xl font-semibold">
          Manage team members
        </h2>

        <p className="mb-4 text-sm text-muted">
          {members.length} team members in your database
        </p>

        <label
          htmlFor="search"
          className="mb-2 block text-sm font-medium"
        >
          Search team members
        </label>

        <input
          id="search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, role, or bio..."
          className="mb-6 w-full rounded-lg border border-border bg-transparent px-4 py-3"
        />

        {loading ? (
          <p className="text-muted">Loading team members...</p>
        ) : filteredMembers.length === 0 ? (
          <p className="text-muted">
            No team members found. Add a member above or try a different search.
          </p>
        ) : (
          <div className="space-y-4">
            {filteredMembers.map((member) => (
              <article
                key={member.id}
                className="rounded-xl border border-border p-5"
              >
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-semibold">{member.name}</h3>

                  <span className="rounded-full border border-border px-3 py-1 text-xs">
                    {member.is_published ? "Published" : "Hidden"}
                  </span>
                </div>

                <p className="text-sm text-primary">{member.role}</p>

                {member.bio && (
                  <p className="mt-2 whitespace-pre-wrap text-muted">
                    {member.bio}
                  </p>
                )}

                <p className="mt-2 text-xs text-muted">
                  Display order: {member.display_order}
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => startEditing(member)}
                    className="rounded-lg border border-border px-4 py-2"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => void deleteMember(member)}
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
