import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ContactForm from "./ContactForm";
import { site } from "@/data/content";


export const metadata: Metadata = {
  title: "Contact BioCode Innovators",
  description:
    "Contact BioCode Innovators Research Wing with questions about research publications, courses, fellowships, internships, and student opportunities.",
};


export default function Contact({ searchParams }: { searchParams: { topic?: string } }) {
  return (
    <>
      <PageHeader title="Contact" intro="Questions about research, courses, the fellowship or internships? Send us a message." />
      <section className="container-page py-14">
        <p className="mb-8 max-w-xl text-muted">
          You can also write to us at <span className="font-semibold text-ink">{site.email}</span>{" "}
          (<a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${site.email}`} target="_blank" rel="noopener noreferrer" className="arrow-link">open in Gmail</a>).
        </p>
        <ContactForm defaultTopic={searchParams.topic ?? ""} />
      </section>
    </>
  );
}
