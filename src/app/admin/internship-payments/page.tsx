import InternshipReview from "../submissions/InternshipReview";

export const metadata = { title: "Internship payments" };

export default function AdminInternshipPayments() {
  return <InternshipReview initialView="payments" />;
}
