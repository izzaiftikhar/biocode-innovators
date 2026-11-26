import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy | BioCode Innovators",
  description: "How BioCode Innovators collects, uses and protects your information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro="This policy explains what information BioCode Innovators collects when you use this website, why we collect it, and the choices you have."
      updated="November 25, 2026"
      sections={[
        {
          heading: "Information we collect",
          items: [
            "Account details: your name and email address when you sign up.",
            "Learning data: course enrolment, module progress, quiz attempts and scores, and certificates issued to you.",
            "Programme data: applications, submissions and files you upload for internships, the fellowship or the student journal.",
            "Messages you send through our feedback and contact forms.",
            "Basic technical data such as browser type and pages visited, used to keep the site working and secure.",
          ],
        },
        {
          heading: "How we use your information",
          items: [
            "To create and manage your account and let you sign in securely.",
            "To run courses, quizzes, internships and other programmes, and to issue certificates.",
            "To respond to your messages and feedback.",
            "To improve the site and keep it safe from misuse.",
          ],
        },
        {
          heading: "Who can see it",
          paragraphs: [
            "Your profile and learning data are visible to you. Authorised BioCode administrators and mentors can view the information needed to run the programmes you take part in. We do not sell your personal information.",
          ],
        },
        {
          heading: "Service providers",
          paragraphs: [
            "We rely on trusted providers for hosting, authentication, database storage and email delivery. They process data on our behalf only to provide those services.",
          ],
        },
        {
          heading: "Your choices and rights",
          paragraphs: [
            "You can ask us to access, correct or delete the personal information we hold about you. Your name on a certificate is taken from your account, so please check it before completing a course.",
            "To make a request, email us at biocodeinnovators13@gmail.com.",
          ],
        },
        {
          heading: "Security and retention",
          paragraphs: [
            "We use access controls and secure connections to protect your data. We keep information only as long as needed to run your account and programmes, or as required by law.",
          ],
        },
        {
          heading: "Changes to this policy",
          paragraphs: [
            "We may update this policy from time to time. The date at the top shows when it last changed.",
          ],
        },
      ]}
    />
  );
}