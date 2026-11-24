import InternshipReview from "../submissions/InternshipReview";

export const metadata = { title: "Internship tasks" };

export default function AdminInternshipTasks() {
  return <InternshipReview initialView="tasks" />;
}
