
import type { Metadata } from "next";
import SearchClient from "./SearchClient";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Search BioCode Innovators for research publications, courses, announcements, and team members.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function SearchPage() {
  return <SearchClient />;
}
