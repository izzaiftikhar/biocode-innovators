import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Use | BioCode Innovators",
  description: "The terms for using the BioCode Innovators website and programmes.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Use"
      intro="By using the BioCode Innovators website you agree to these terms. Please read them carefully."
      updated="November 25, 2026"
      sections={[
        {
          heading: "Your account",
          paragraphs: [
            "You are responsible for the accuracy of the information you provide and for keeping your password private. Please tell us right away if you think your account has been accessed without your permission.",
          ],
        },
        {
          heading: "Acceptable use",
          items: [
            "Do not attempt to break, overload or gain unauthorised access to the site.",
            "Do not submit work that is not your own, or share quiz answers or course content in ways that undermine fair assessment.",
            "Do not post unlawful, abusive or misleading content.",
          ],
        },
        {
          heading: "Courses, quizzes and certificates",
          paragraphs: [
            "Certificates are issued when the pass requirements of a course are met. BioCode may withhold or withdraw a certificate if it was obtained through cheating or false information.",
          ],
        },
        {
          heading: "Internships, fellowship and journal",
          paragraphs: [
            "Each programme may have its own eligibility rules, deadlines and expectations, which are shown on its page. Taking part means you agree to follow them.",
          ],
        },
        {
          heading: "Content and ownership",
          paragraphs: [
            "The BioCode name, logo, course materials and site design belong to BioCode Innovators. Work you create remains yours. By submitting it for publication, such as in the student journal, you allow us to display it on the site.",
          ],
        },
        {
          heading: "Availability and liability",
          paragraphs: [
            "We work to keep the site available and accurate, but we provide it as is and cannot guarantee uninterrupted access. To the extent permitted by law, BioCode Innovators is not liable for losses arising from use of the site.",
          ],
        },
        {
          heading: "Changes and contact",
          paragraphs: [
            "We may update these terms from time to time. Continued use of the site means you accept the updated terms. Questions can be sent to biocodeinnovators13@gmail.com.",
          ],
        },
      ]}
    />
  );
}