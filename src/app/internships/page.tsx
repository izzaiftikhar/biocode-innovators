
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import InternshipListings from "./InternshipListings";

export const metadata: Metadata = {
  title: "Research Internships",
  description:
    "Explore BioCode Innovators internship opportunities, including research roles, departments, duration, work modes, stipends, and application details.",
};

export default function Internships() {
  return (
    <>
      <PageHeader
        title="Internships"
        intro="Paid and unpaid opportunities, with clear details before you apply."
      />

      <InternshipListings />
    </>
  );
}
