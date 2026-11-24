import Link from "next/link";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { site } from "@/data/content";


export const metadata: Metadata = {
  title: "Research Fellowship",
  description:
    "Discover the BioCode Innovators Research Fellowship, including its application process, research mentoring, publication goals, and completion certificate.",
};

const steps = ["Application", "Selection", "Mentoring", "Output"];

export default function Fellowship() {
  return (
    <>
      <PageHeader title="Research Fellowship" intro="Mentored research for selected students, ending in a published output and a completion certificate." />
      <section className="container-page py-14">
        <h2 className="text-2xl font-semibold">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s} className="rounded-lg border border-line p-5"><span className="font-heading text-primary">{i + 1}</span><p className="mt-1 font-semibold">{s}</p></li>
          ))}
        </ol>
        <p className="mt-8 max-w-2xl text-muted">Who it is for, duration, benefits and requirements will be added from the client's fellowship document.</p>
        <Link href="/contact?topic=Fellowship%20application" className="btn mt-6">Email us to apply</Link>
      </section>
    </>
  );
}
