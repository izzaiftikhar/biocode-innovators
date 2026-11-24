import Link from "next/link";
import Card from "@/components/Card";

const sections = [
  {
    label: "Overview",
    title: "Platform Analytics",
    description:
      "Monitor student enrolments, course performance, assignment reviews, quiz results, and certificates.",
    href: "/admin/analytics",
    cta: "View analytics",
  },
  {
    label: "Research",
    title: "Publications",
    description:
      "Add, edit, and manage research publications in the Research Wing library.",
    href: "/admin/publications",
    cta: "Manage publications",
  },
  {
    label: "Research",
    title: "Student Journal",
    description:
      "Add, edit, publish, and choose which student journal entries appear in the carousel.",
    href: "/admin/student-journal",
    cta: "Manage student journal",
  },
  {
    label: "Communication",
    title: "Updates & Announcements",
    description:
      "Publish announcements, share resources, and manage community updates.",
    href: "/admin/updates",
    cta: "Manage updates",
  },
  {
    label: "People",
    title: "Core Team & Guidance",
    description:
      "Add, edit, publish, and remove team members displayed on the About page.",
    href: "/admin/team",
    cta: "Manage team",
  },
  {
    label: "Website",
    title: "Homepage Hero",
    description:
      "Upload, preview, replace, or remove the main visual displayed in the homepage hero section.",
    href: "/admin/home-hero",
    cta: "Manage homepage hero",
  },
  {
    label: "Website",
    title: "About Page Settings",
    description:
      "Change the About page hero image and badge without changing the founder portrait.",
    href: "/admin/about",
    cta: "Edit About page",
  },
  {
    label: "Learning",
    title: "Courses",
    description:
      "Manage courses and access the public learning section.",
    href: "/admin/courses",
    cta: "Manage courses",
  },
  {
    label: "Opportunities",
    title: "Internships",
    description:
      "Create internships, add tasks and instructions, upload the task PDF and the certificate and appreciation letter templates, and set certificate payment details.",
    href: "/admin/internships",
    cta: "Manage internships",
  },
  {
    label: "Opportunities",
    title: "Internship Tasks",
    description:
      "Review tasks submitted by interns, enter scores and feedback, and approve work or request revisions.",
    href: "/admin/internship-tasks",
    cta: "Review tasks",
  },
  {
    label: "Opportunities",
    title: "Internship Payments",
    description:
      "Check payment screenshots from interns and approve them so their certificates can be issued.",
    href: "/admin/internship-payments",
    cta: "Review payments",
  },
  {
    label: "Learning",
    title: "Submissions & Grading",
    description:
      "Review student assignment files, enter scores and feedback, and approve work or request corrections.",
    href: "/admin/submissions",
    cta: "Review submissions",
  },
  {
    label: "Community",
    title: "Student Feedback",
    description:
      "Review student experiences, approve submissions, edit public wording, and manage publication placements.",
    href: "/admin/feedback",
    cta: "Review feedback",
  },
  {
    label: "Learning",
    title: "Final Quizzes",
    description:
      "Write each course's final quiz, set the pass mark, and review or reset student attempts.",
    href: "/admin/quiz",
    cta: "Manage quizzes",
  },
  {
    label: "Website",
    title: "Chatbot Knowledge",
    description:
      "Add approved facts about BioCode so the website chatbot answers visitors correctly.",
    href: "/admin/chatbot-knowledge",
    cta: "Manage chatbot answers",
  },
  {
    label: "Community",
    title: "Applications",
    description:
      "A dedicated application review and management page is planned.",
    href: null,
    cta: null,
  },
  {
    label: "Recognition",
    title: "Certificates",
    description:
      "Upload certificate templates, set name and QR positions, and revoke or reissue certificates.",
    href: "/admin/certificates",
    cta: "Manage certificates",
  },
];

export default function Admin() {
  return (
    <main className="container-page py-12">
      <header className="mb-10">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted">
          BioCode Innovators · Research Wing
        </p>

        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Admin dashboard
        </h1>

        <p className="mt-3 max-w-2xl text-muted">
          Manage the Research Wing through dedicated sections. Choose a
          section below to continue.
        </p>
      </header>

      <section
        aria-label="Admin management sections"
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {sections.map((section) => (
          <Card
            key={section.title}
            label={section.label}
            title={section.title}
            href={section.href ?? undefined}
            cta={section.cta ?? undefined}
          >
            {section.description}

            {!section.href && (
              <p className="mt-3 text-xs font-medium text-muted">
                Coming soon
              </p>
            )}
          </Card>
        ))}
      </section>

      <footer className="mt-12 border-t border-line pt-6">
        <Link
          href="/"
          className="text-sm text-muted underline underline-offset-4 hover:text-primary"
        >
          Return to public website
        </Link>
      </footer>
    </main>
  );
}
