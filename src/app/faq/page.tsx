import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { faqs } from "@/data/faqs";
import FaqList from "./FaqList";
import AskAssistantButton from "./AskAssistantButton";

export const metadata: Metadata = {
  title: "FAQs",
  description: "Answers about BioCode courses, enrollment, assignments, certificates, internships, publications, the Student Journal and the community.",
};

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <>
      <PageHeader
        title="Frequently Asked Questions ?"
        intro="Find quick answers about courses, enrollment, assignments, certificates, internships and more."
      />

      <section className="container-page py-12 sm:py-16">
        <FaqList faqs={faqs} />

        <div className="relative mt-16 overflow-hidden rounded-2xl bg-secondary px-6 py-10 text-white sm:px-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(30rem 14rem at 100% 0%, rgb(34 211 238 / 0.25), transparent 60%)" }}
          />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="!text-white text-2xl font-semibold">Still have a question?</h2>
              <p className="mt-2 text-white/75">
                Ask our assistant for an instant answer, or send a message and the BioCode team will get back to you.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/contact" className="inline-flex items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-semibold text-secondary transition-colors hover:bg-white">
                Contact us
              </Link>
              <AskAssistantButton />
            </div>
          </div>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
