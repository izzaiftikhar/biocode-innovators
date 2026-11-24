import type { Metadata } from "next";
import Link from "next/link";
import Card from "@/components/Card";
import Coverflow, { type Slide } from "@/components/Coverflow";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Student Research Journal",
  description:
    "Explore student-led scientific publications and research papers featured in the BioCode Innovators Student Journal.",
};

export const dynamic = "force-dynamic";

type StudentJournalEntry = {
  id: string;
  title: string;
  student_name: string;
  publication_date: string;
  domain: string;
  description: string | null;
  pdf_url: string;
  image_url: string | null;
  is_featured: boolean;
  featured_order: number;
};

export default async function StudentJournal() {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("student_journals")
    .select(
      "id, title, student_name, publication_date, domain, description, pdf_url, image_url, is_featured, featured_order"
    )
    .eq("is_published", true)
    .order("publication_date", { ascending: false });

  if (error) {
    console.error("Student Journal query error:", error);
  }

  const entries: StudentJournalEntry[] = error ? [] : data ?? [];

  // Carousel = only the entries the admin marked as featured.
  // Sorted by the admin's chosen order (ties keep newest first).
  const featured = entries
    .filter((entry) => entry.is_featured)
    .sort((a, b) => a.featured_order - b.featured_order)
    .slice(0, 8);

  const slides: Slide[] = featured.map((entry) => ({
    image: entry.image_url || "/images/journal-hero.jpg",
    label: "Journal",
    title: entry.title,
    text: entry.student_name,
    href: entry.pdf_url,
    external: true,
    cta: "Read paper",
  }));

  return (
    <>
      {/* Banner (no DNA helix image) */}
      <section className="page-hero biocode-hero relative overflow-hidden text-white">
        <div className="hero-glow hero-glow-one" aria-hidden="true" />
        <div className="hero-grid-pattern" aria-hidden="true" />

        <div className="container-page relative z-10 py-8 lg:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
            BioCode Innovators
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-5xl">
            Student Journal
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
            Short publications by students. Open any entry to read the full
            paper.
          </p>
        </div>

        <div className="hero-bottom-line" />
      </section>

      {featured.length > 0 && (
        <section className="container-page py-14">
          <h2 className="mb-6 text-2xl font-semibold">Featured entries</h2>
          <Coverflow
            slides={slides}
            ariaLabel="Featured student journal entries"
          />
        </section>
      )}

      <section className="container-page pb-14">
        <h2 className="text-2xl font-semibold">All entries</h2>

        {entries.length > 0 ? (
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {entries.map((entry) => (
              <Card
                key={entry.id}
                label="Journal"
                title={entry.title}
                image={entry.image_url || "/images/journal-hero.jpg"}
                href={entry.pdf_url}
                cta="Read paper"
              >
                <p>
                  {entry.student_name} · {entry.publication_date}
                </p>

                {entry.description && (
                  <p className="mt-2">{entry.description}</p>
                )}

                <p className="mt-3 flex flex-wrap gap-2">
                  <span className="chip">{entry.domain}</span>
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-gray-500">
            No student journal entries have been published yet.
          </p>
        )}

        <Link
          href="/contact?topic=Student%20Journal"
          className="btn mt-10 inline-block"
        >
          Want to publish here? Email us
        </Link>
      </section>
    </>
  );
}
