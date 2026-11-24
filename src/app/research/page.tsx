import Link from "next/link";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Coverflow, { type Slide } from "@/components/Coverflow";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Research Publications",
  description:
    "Explore BioCode Innovators research publications, scholarly articles, authors, abstracts, journals, and research opportunities.",
};

// Always read fresh data so an admin's "feature" change shows immediately.
export const dynamic = "force-dynamic";

type Publication = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  doi: string | null;
  external_url: string;
  pdf_url: string | null;
  abstract: string | null;
  type: string | null;
  tags: string[] | null;
  image_url: string | null;
  is_featured: boolean;
  featured_order: number;
};

export default async function Research() {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("publications")
    .select(
      "id, title, authors, year, journal, doi, external_url, pdf_url, abstract, type, tags, image_url, is_featured, featured_order"
    )
    .eq("is_published", true)
    .order("year", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Failed to load research publications:", error.message);
    throw new Error("Unable to load research publications.");
  }

  const publications: Publication[] = data ?? [];

  // Carousel = only the publications the admin marked as featured.
  // Sorted by the admin's chosen order (ties keep newest-year first).
  const featured = publications
    .filter((p) => p.is_featured)
    .sort((a, b) => a.featured_order - b.featured_order)
    .slice(0, 8);

  const slides: Slide[] = featured.map((p) => ({
    image: p.image_url ?? "/images/card-1.jpg",
    label: p.type ?? "Research",
    title: p.title,
    text: `${p.authors.join(", ")} · ${p.year ?? "Year not specified"}`,
    href: p.pdf_url || p.external_url,
    external: true,
    cta: "Read paper",
  }));

  const jsonLd = publications.map((p) => ({
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: p.title,
    ...(p.year ? { datePublished: String(p.year) } : {}),
    author: p.authors.map((name) => ({
      "@type": "Person",
      name,
    })),
    ...(p.journal
      ? {
          isPartOf: {
            "@type": "Periodical",
            name: p.journal,
          },
        }
      : {}),
    url: p.pdf_url || p.external_url,
    ...(p.doi ? { sameAs: `https://doi.org/${p.doi}` } : {}),
  }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />

      <PageHeader
        title="Research"
        intro="The official record of research done under Biocode Innovators."
      />

      {featured.length > 0 && (
        <section className="container-page pt-14">
          <Coverflow
            slides={slides}
            ariaLabel="Featured publications"
          />
        </section>
      )}

      <section className="container-page py-14">
        <h2 className="text-2xl font-semibold">Publications</h2>

        {publications.length === 0 ? (
          <p className="mt-6 text-muted">
            No publications have been published yet. Please check back soon.
          </p>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {publications.map((p) => (
              <Card
                key={p.id}
                label={p.type ?? "Research"}
                title={p.title}
                image={p.image_url ?? undefined}
                href={p.pdf_url || p.external_url}
                cta="Read paper"
              >
                <p>
                  {p.authors.join(", ")}
                  {p.year ? ` (${p.year})` : ""}.
                  {p.journal ? ` ${p.journal}.` : ""}
                  {p.doi ? ` DOI: ${p.doi}` : ""}
                </p>

                {p.abstract && (
                  <p className="mt-3">{p.abstract}</p>
                )}

                {p.tags && p.tags.length > 0 && (
                  <p className="mt-3 flex flex-wrap gap-2">
                    {p.tags.map((tag) => (
                      <span key={tag} className="chip">
                        {tag}
                      </span>
                    ))}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="container-page pb-10">
        <div className="rounded-lg border border-line bg-surface p-8">
          <h2 className="text-2xl font-semibold">Join the research</h2>

          <p className="mt-2 max-w-2xl text-muted">
            Tell us about your interests and experience. If accepted, you get
            a research dashboard to track your project.
          </p>

          <Link
            href="/contact?topic=Research%20application"
            className="btn mt-6"
          >
            Email us to apply
          </Link>
        </div>
      </section>
    </>
  );
}
