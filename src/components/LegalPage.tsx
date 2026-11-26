
export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
};

type Props = {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
};

export default function LegalPage({
  eyebrow,
  title,
  intro,
  updated,
  sections,
}: Props) {
  return (
    <main>
      <section className="bg-[#0B1F4D] text-white">
        <div className="container-page py-14 md:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#22D3EE]">
            {eyebrow}
          </p>

          <h1 className="mt-4 font-heading text-4xl font-semibold text-white md:text-5xl">
            {title}
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-white/80">
            {intro}
          </p>

          <p className="mt-4 text-sm text-white/60">
            Last updated: {updated}
          </p>
        </div>
      </section>

      <section className="container-page py-12 md:py-16">
        <div className="mx-auto max-w-3xl space-y-10">
          {sections.map((section) => (
            <article key={section.heading}>
              <h2 className="font-heading text-xl font-semibold text-secondary md:text-2xl">
                {section.heading}
              </h2>

              {section.paragraphs?.map((p) => (
                <p
                  key={p}
                  className="mt-3 text-[15px] leading-7 text-ink/80"
                >
                  {p}
                </p>
              ))}

              {section.items && (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-ink/80">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
