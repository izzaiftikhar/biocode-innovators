
"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";

type Update = {
  id: string;
  title: string;
  content: string;
  external_url: string | null;
  created_at: string;
};

export default function Updates() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUpdates() {
      const supabase = createBrowserSupabase();

      const { data, error } = await supabase
        .from("updates")
        .select("id, title, content, external_url, created_at")
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (error) {
        setError("Unable to load announcements. Please try again later.");
      } else {
        setUpdates(data ?? []);
      }

      setLoading(false);
    }

    void loadUpdates();
  }, []);

  return (
    <>
      <PageHeader
        title="Updates"
        intro="News, workshops and BioCode briefings, including the Marine edition."
      />

      <section className="container-page grid gap-6 py-14 md:grid-cols-2">
        {loading ? (
          <p className="text-muted">Loading announcements...</p>
        ) : error ? (
          <p className="text-muted">{error}</p>
        ) : updates.length === 0 ? (
          <p className="text-muted">
            No announcements have been published yet.
          </p>
        ) : (
          updates.map((update) => (
            <article
              key={update.id}
              className="rounded-xl border border-border p-6"
            >
              <p className="text-xs text-muted">
                {new Date(update.created_at).toLocaleDateString()}
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                {update.title}
              </h2>

              <p className="mt-3 whitespace-pre-wrap text-muted">
                {update.content}
              </p>

              {update.external_url && (
                <a
                  href={update.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block underline underline-offset-4"
                >
                  Read more →
                </a>
              )}
            </article>
          ))
        )}
      </section>
    </>
  );
}
