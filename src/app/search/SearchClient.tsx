
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Result = {
  id: string;
  kind: string;
  title: string;
  description: string;
  searchText: string;
  href: string;
  external?: boolean;
};

type Publication = {
  id: string;
  title: string;
  authors: string[] | null;
  year: number | null;
  journal: string | null;
  doi: string | null;
  external_url: string | null;
  pdf_url: string | null;
  abstract: string | null;
  type: string | null;
  tags: string[] | null;
};

type StudentJournal = {
  id: string;
  title: string;
  student_name: string | null;
  publication_date: string | null;
  domain: string | null;
  description: string | null;
  pdf_url: string | null;
};

type Course = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  level: string | null;
  duration: string | null;
  delivery: string | null;
  is_free: boolean | null;
};

type Internship = {
  id: string;
  title: string;
  department: string | null;
  duration: string | null;
  mode: string | null;
  is_paid: boolean;
  stipend_details: string | null;
  is_open: boolean;
  description: string | null;
};

type Update = {
  id: string;
  title: string;
  content: string;
  external_url: string | null;
  created_at: string;
};

type TeamMember = {
  id: string;
  name: string;
  role: string | null;
  bio: string | null;
};

function makeResult(
  result: Result
): Result {
  return result;
}

export default function Search() {
  const [q, setQ] = useState("");
  const [index, setIndex] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSearchIndex() {
      try {
        const supabase = createBrowserSupabase();

        const [
          publicationsResponse,
          journalsResponse,
          coursesResponse,
          internshipsResponse,
          updatesResponse,
          teamResponse,
        ] = await Promise.all([
          supabase
            .from("publications")
            .select(
              "id, title, authors, year, journal, doi, external_url, pdf_url, abstract, type, tags"
            )
            .eq("is_published", true)
            .order("year", { ascending: false, nullsFirst: false }),

          supabase
            .from("student_journals")
            .select(
              "id, title, student_name, publication_date, domain, description, pdf_url"
            )
            .eq("is_published", true)
            .order("publication_date", { ascending: false }),

          supabase
            .from("courses")
            .select(
              "id, slug, title, summary, level, duration, delivery, is_free"
            )
            .eq("published", true)
            .order("created_at", { ascending: false }),

          supabase
            .from("internships")
            .select(
              "id, title, department, duration, mode, is_paid, stipend_details, is_open, description"
            )
            .eq("published", true)
            .order("created_at", { ascending: false }),

          supabase
            .from("updates")
            .select("id, title, content, external_url, created_at")
            .eq("published", true)
            .order("created_at", { ascending: false }),

          supabase
            .from("about_team_members")
            .select("id, name, role, bio")
            .eq("is_published", true)
            .order("display_order", { ascending: true }),
        ]);

        const errors = [
          publicationsResponse.error,
          journalsResponse.error,
          coursesResponse.error,
          internshipsResponse.error,
          updatesResponse.error,
          teamResponse.error,
        ].filter(Boolean);

        if (errors.length > 0) {
          console.error("Some search categories could not load:", errors);
        }

        const results: Result[] = [];

        for (const p of (publicationsResponse.data ?? []) as Publication[]) {
          results.push(
            makeResult({
              id: p.id,
              kind: "Research Publication",
              title: p.title,
              description:
                p.abstract || p.journal || "Research publication",
              searchText: [
                p.title,
                ...(p.authors ?? []),
                p.year,
                p.journal,
                p.doi,
                p.abstract,
                p.type,
                ...(p.tags ?? []),
              ].join(" "),
              href: p.pdf_url || p.external_url || "/research",
              external: Boolean(p.pdf_url || p.external_url),
            })
          );
        }

        for (const journal of (journalsResponse.data ?? []) as StudentJournal[]) {
          results.push(
            makeResult({
              id: journal.id,
              kind: "Student Journal",
              title: journal.title,
              description:
                journal.description || journal.domain || "Student publication",
              searchText: [
                journal.title,
                journal.student_name,
                journal.publication_date,
                journal.domain,
                journal.description,
              ].join(" "),
              href: journal.pdf_url || "/student-journal",
              external: Boolean(journal.pdf_url),
            })
          );
        }

        for (const course of (coursesResponse.data ?? []) as Course[]) {
          results.push(
            makeResult({
              id: course.id,
              kind: "Course",
              title: course.title,
              description:
                course.summary ||
                [course.level, course.duration, course.delivery]
                  .filter(Boolean)
                  .join(" • "),
              searchText: [
                course.title,
                course.summary,
                course.level,
                course.duration,
                course.delivery,
                course.is_free ? "free" : "paid",
              ].join(" "),
              href: `/courses/${course.slug}`,
            })
          );
        }

        for (const internship of (internshipsResponse.data ?? []) as Internship[]) {
          results.push(
            makeResult({
              id: internship.id,
              kind: "Internship",
              title: internship.title,
              description:
                internship.description ||
                [
                  internship.department,
                  internship.duration,
                  internship.mode,
                ]
                  .filter(Boolean)
                  .join(" • "),
              searchText: [
                internship.title,
                internship.department,
                internship.duration,
                internship.mode,
                internship.description,
                internship.is_paid ? "paid" : "unpaid",
                internship.is_paid ? internship.stipend_details : "",
                internship.is_open ? "open accepting applications" : "closed",
              ].join(" "),
              href: `/internships/${internship.id}`,
            })
          );
        }

        for (const update of (updatesResponse.data ?? []) as Update[]) {
          results.push(
            makeResult({
              id: update.id,
              kind: "Update",
              title: update.title,
              description: update.content,
              searchText: [
                update.title,
                update.content,
                update.created_at,
              ].join(" "),
              href: update.external_url || "/updates",
              external: Boolean(update.external_url),
            })
          );
        }

        for (const member of (teamResponse.data ?? []) as TeamMember[]) {
          results.push(
            makeResult({
              id: member.id,
              kind: "Team Member",
              title: member.name,
              description: [member.role, member.bio]
                .filter(Boolean)
                .join(" — "),
              searchText: [
                member.name,
                member.role,
                member.bio,
              ].join(" "),
              href: "/about",
            })
          );
        }

        if (active) {
          setIndex(results);

          if (errors.length > 0) {
            setError(
              "Some search categories could not be loaded. Other available results are still searchable."
            );
          }
        }
      } catch (err) {
        console.error("Unable to load search index:", err);

        if (active) {
          setError(
            "Unable to load search right now. Please refresh the page and try again."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSearchIndex();

    return () => {
      active = false;
    };
  }, []);

  const results = useMemo(() => {
    const terms = q
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (terms.length === 0) return [];

    return index.filter((result) => {
      const searchableText =
      `${result.kind} ${result.title} ${result.description} ${result.searchText}`
      .toLowerCase();

      return terms.every((term) => searchableText.includes(term));
    });
  }, [q, index]);

  return (
    <>
      <PageHeader
        title="Search"
        intro="Find research publications, student journals, courses, internships, updates and people."
      />

      <section className="container-page py-14">
        <div className="mx-auto max-w-3xl">
          <label
            htmlFor="q"
            className="mb-2 block text-sm font-semibold"
          >
            Search the site
          </label>

          <input
            id="q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search bioinformatics, research, courses..."
            autoComplete="off"
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
          />

          {loading && (
            <p className="mt-6 text-sm text-gray-500">
              Loading searchable content...
            </p>
          )}

          {!loading && error && (
            <p
              className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              role="status"
            >
              {error}
            </p>
          )}

          {!loading && q.trim() && (
            <p className="mt-6 text-sm text-gray-500">
              {results.length}{" "}
              {results.length === 1 ? "result" : "results"} found
            </p>
          )}

          {!loading && !q.trim() && (
            <p className="mt-6 text-sm text-gray-500">
              Enter a keyword to search across BioCode Innovators.
            </p>
          )}

          {!loading && q.trim() && results.length === 0 && (
            <div className="mt-8 rounded-xl border border-gray-200 p-6 text-center">
              <h2 className="font-semibold text-gray-900">
                No results found
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Try another keyword or a shorter search phrase.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-6 space-y-4">
              {results.map((result) => (
                <article
                  key={`${result.kind}-${result.id}`}
                  className="rounded-xl border border-gray-200 bg-white p-5 transition hover:border-teal-500 hover:shadow-sm"
                >
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-700">
                    {result.kind}
                  </p>

                  <h2 className="font-semibold text-gray-900">
                    {result.external ? (
                      <a
                        href={result.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-teal-700"
                      >
                        {result.title}
                      </a>
                    ) : (
                      <Link
                        href={result.href}
                        className="hover:text-teal-700"
                      >
                        {result.title}
                      </Link>
                    )}
                  </h2>

                  {result.description && (
                    <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-gray-600">
                      {result.description}
                    </p>
                  )}

                  <div className="mt-3">
                    {result.external ? (
                      <a
                        href={result.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="arrow-link inline-block text-sm"
                      >
                        Open result →
                      </a>
                    ) : (
                      <Link
                        href={result.href}
                        className="arrow-link inline-block text-sm"
                      >
                        View result →
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
