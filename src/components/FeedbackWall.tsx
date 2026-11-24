import Link from "next/link";

export type PublicFeedback = {
  id: string;
  display_name: string;
  message: string;
  rating: number | null;
  type: "platform" | "course";
  course_title: string | null;
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

export default function FeedbackWall({ items }: { items: PublicFeedback[] }) {
  return (
    <main>
      {/* HERO: same structure as the homepage and courses heroes */}
      <section className="page-hero biocode-hero relative overflow-hidden bg-secondary text-white">
        <div className="hero-glow hero-glow-one" aria-hidden="true" />
        <div className="hero-glow hero-glow-two" aria-hidden="true" />
        <div className="hero-grid-pattern" aria-hidden="true" />

        <div className="container-page relative z-10 py-8 lg:py-10">
          <p className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            BIOCODE INNOVATORS · STUDENT VOICES
          </p>

          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            Real voices.{" "}
            <span className="hero-gradient-text">Real discovery.</span>
          </h1>

          <p className="mt-3 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
            Honest experiences from students and researchers learning with BioCode Innovators.
          </p>
        </div>

        <div className="hero-bottom-line" />
      </section>

      {/* FEEDBACK WALL */}
      <section className="container-page py-16 md:py-20">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-10 text-center">
            <h2 className="font-heading text-lg font-semibold text-secondary">
              No feedback has been published yet
            </h2>
            <p className="mt-2 text-sm text-muted">
              Reviews from our students will appear here once they are published.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((f) => (
              <article
                key={f.id}
                className="flex flex-col rounded-2xl border border-line border-l-4 border-l-primary bg-bg p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                {f.rating ? <Stars value={f.rating} /> : null}

                <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-ink">
                  “{f.message}”
                </blockquote>

                <footer className="mt-5 flex items-center gap-3 border-t border-line pt-4">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-white"
                  >
                    {f.display_name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-secondary">
                      {f.display_name}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {f.type === "course" && f.course_title
                        ? f.course_title
                        : "BioCode Innovators platform"}
                    </p>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-14 rounded-2xl border border-line bg-surface p-8 text-center md:p-10">
          <h2 className="font-heading text-xl font-semibold text-secondary">Learned with us?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
            Share your experience. Approved feedback helps future students choose with confidence.
          </p>
          <Link
            href="/dashboard/feedback"
            className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Give feedback
          </Link>
        </div>
      </section>
    </main>
  );
}
