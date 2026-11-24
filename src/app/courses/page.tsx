
import type { Metadata } from "next";
import CoursesClient from "./CoursesClient";

export const metadata: Metadata = {
  title: "Courses",
  description:
    "Explore BioCode Innovators courses and discover learning opportunities in science, research, and computational biology.",
};

export default function CoursesPage() {
  return <CoursesClient />;
}
