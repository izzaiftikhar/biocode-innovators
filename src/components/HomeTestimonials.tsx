import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

type Row = {
  id: string;
  feedback_type: "platform" | "course";
  course_id: string | null;
  rating: number | null;
  content: string;
  admin_edited_content: string | null;
  public_display_name: string | null;
};

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={`h-4 w-4 ${i <= value ? "fill-amber-400" : "fill-slate-200"}`}
          aria-hidden="true"
        >
          <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z" />
        </svg>
      ))}
    </div>
  );
}

export default async function HomeTestimonials() {
  const db = createServerSupabase();

  const { data, error } = await db
    .from("student_feedback")
    .select(
      "id, feedback_type, course_id, rating, content, admin_edited_content, public_display_name"
    )
    .eq("is_published", true)
    .eq("status", "approved")
    .eq("public_consent", true)
    .contains("display_placement", ["homepage"])
    .order("published_at", { ascending: false })
    .limit(3);

  if (error) console.error("Homepage testimonials query failed:", error.message);

  const rows = (data ?? []) as Row[];

  // Nothing published for the homepage yet: render nothing at all.
  if (rows.length === 0) return null;

  const courseIds = [
    ...new Set(rows.map((r) => r.course_id).filter((id): id is string => !!id)),
  ];
  const titles = new Map<string, string>();

  if (courseIds.length > 0) {
    const { data: courses } = await db
      .from("courses")
      .select("id, title")
      .in("id", courseIds);
    for (const c of courses ?? []) titles.set(c.id, c.title);
  }

  return (
    <section className="container-page py-20" aria-labelledby="home-testimonials-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">STUDENT VOICES</p>
          <h2 id="home-testimonials-heading" className="mt-3 text-3xl font-semibold sm:text-4xl">
            What our community says
          </h2>
        </div>

        <Link href="/feedback" className="arrow-link text-sm">
          All feedback →
        </Link>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const name = row.public_display_name?.trim() || "BioCode student";
          const message = (row.admin_edited_content?.trim() || row.content).trim();
          const source =
            row.feedback_type === "course" && row.course_id
              ? titles.get(row.course_id) ?? "BioCode course"
              : "BioCode Innovators platform";

          return (
            <figure
              key={row.id}
              className="flex flex-col rounded-2xl border border-line border-l-4 border-l-primary bg-bg p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              {row.rating ? <Stars value={row.rating} /> : null}

              <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-ink">
                “{message}”
              </blockquote>

              <figcaption className="mt-5 flex items-center gap-3 border-t border-line pt-4">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-white"
                >
                  {name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-secondary">{name}</span>
                  <span className="block truncate text-xs text-muted">{source}</span>
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
