
import type { Metadata } from "next";
import UpdatesClient from "./UpdatesClient";

export const metadata: Metadata = {
  title: "Updates & Announcements",
  description:
    "Read the latest BioCode Innovators announcements, research updates, learning opportunities, workshops, and community news.",
};

export default function UpdatesPage() {
  return <UpdatesClient />;
}
