// Static FAQ content. It is also the chatbot's approved knowledge source (see /api/chat).
// To change an answer, edit it here; both the FAQ page and the chatbot update together.

export type Faq = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  link?: { href: string; label: string };
};

export const FAQ_CATEGORIES = [
  "Courses",
  "Enrolment",
  "Assignments",
  "Certificates",
  "Fellowship",
  "Internships",
  "Publications",
  "Student Journal",
  "Community",
] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export const faqs: Faq[] = [
  // Courses
  { id: "courses-what", category: "Courses", question: "What courses does BioCode offer?",
    answer: "BioCode offers structured, module-by-module courses linked to bioinformatics, computational biology, biotechnology and research skills. Each course page lists its level, duration, modules and what you will learn.",
    link: { href: "/courses", label: "Browse courses" } },
  { id: "courses-how", category: "Courses", question: "How do the modules work?",
    answer: "Modules unlock in order. Each module has a lecture video and an assignment. You finish a module when your assignment is approved, and the next module then unlocks.",
    link: { href: "/courses", label: "See the course catalogue" } },
  { id: "courses-video", category: "Courses", question: "Do I have to watch the whole video?",
    answer: "You need to watch at least 90% of a lecture video before its assignment unlocks. Only time you actually watch is counted, so skipping ahead does not count toward the 90%." },
  { id: "courses-cost", category: "Courses", question: "Are the courses free?",
    answer: "Many courses are free. If a course is paid, its page says so and you will need to contact BioCode to enrol.",
    link: { href: "/contact", label: "Contact us" } },

  // Enrolment
  { id: "enrol-how", category: "Enrolment", question: "How do I enrol in a course?",
    answer: "Create an account or sign in, open the course page and select Enrol. Your progress then appears on your dashboard.",
    link: { href: "/login", label: "Sign up or log in" } },
  { id: "enrol-account", category: "Enrolment", question: "Do I need an account?",
    answer: "You can browse publications, courses and updates without one. You need an account to enrol, submit assignments, take the final quiz and receive a certificate." },
  { id: "enrol-password", category: "Enrolment", question: "I forgot my password. What should I do?",
    answer: "Use the reset link on the login page and follow the email we send you.",
    link: { href: "/forgot-password", label: "Reset password" } },

  // Assignments
  { id: "assign-submit", category: "Assignments", question: "How do I submit an assignment?",
    answer: "Once you have met the video requirement, open the module and upload your work in the assignment section. An admin reviews it." },
  { id: "assign-review", category: "Assignments", question: "What happens after I submit?",
    answer: "An admin either approves your work or asks for changes. If changes are requested, update your work and submit it again. Approval completes the module and unlocks the next one." },
  { id: "assign-private", category: "Assignments", question: "Can other students see my work?",
    answer: "No. Submitted files are stored privately and are only visible to you and BioCode admins." },

  // Certificates
  { id: "cert-get", category: "Certificates", question: "How do I get a certificate?",
    answer: "Complete and get approval for every module and, if the course has a final quiz, pass it. Then request your certificate from your dashboard." },
  { id: "cert-quiz", category: "Certificates", question: "How does the final quiz work?",
    answer: "Courses with a final quiz allow one attempt, available after every module is approved. The default pass mark is 90%. If you need help after your attempt, contact BioCode." },
  { id: "cert-name", category: "Certificates", question: "How do I make sure my name is correct on the certificate?",
    answer: "You are asked to confirm your name before the certificate is issued. Check the spelling carefully, because it is printed exactly as confirmed." },
  { id: "cert-verify", category: "Certificates", question: "Can an employer verify my certificate?",
    answer: "Yes. Every certificate has a unique code and QR code that opens a public verification page on this website." },
  { id: "cert-email", category: "Certificates", question: "I did not receive my certificate email.",
    answer: "Check your spam folder first. You can always download the PDF from your dashboard. If it is still missing, contact us.",
    link: { href: "/contact", label: "Contact us" } },

  // Fellowship
  { id: "fellow-what", category: "Fellowship", question: "What is the Research Fellowship?",
    answer: "A mentored research programme for selected students. It runs in four stages: application, selection, mentoring and output, and ends with a published output and a completion certificate.",
    link: { href: "/fellowship", label: "See the fellowship" } },
  { id: "fellow-apply", category: "Fellowship", question: "How do I apply for the fellowship?",
    answer: "Send an application through the fellowship page, which opens a pre-filled contact message to the team. Details such as eligibility, duration and requirements are shared by the team.",
    link: { href: "/contact?topic=Fellowship%20application", label: "Apply by email" } },

  // Internships
  { id: "intern-apply", category: "Internships", question: "How do I apply for an internship?",
    answer: "Open the internships page, choose a role and follow its application instructions. Each listing shows its department, duration, mode and whether it is paid.",
    link: { href: "/internships", label: "View internships" } },

  // Publications
  { id: "pub-find", category: "Publications", question: "Where can I read BioCode's research?",
    answer: "The Research page lists publications with their authors, year, journal and a link to the full paper.",
    link: { href: "/research", label: "Read the research" } },

  // Student Journal
  { id: "journal-what", category: "Student Journal", question: "What is the Student Journal?",
    answer: "A space that showcases work written by students, such as short papers and analyses.",
    link: { href: "/student-journal", label: "Open the Student Journal" } },
  { id: "journal-submit", category: "Student Journal", question: "How can I get my work featured?",
    answer: "Contact the team with a short summary of your work and they will tell you the next steps. The Research Writing course is designed to help you prepare something suitable.",
    link: { href: "/contact", label: "Contact us" } },

  // Community
  { id: "community-join", category: "Community", question: "How do I join the BioCode community?",
    answer: "Create a free account on the website. Community members get updates, event access and a membership certificate that can be verified online. You can also follow BioCode on LinkedIn, YouTube and Instagram.",
    link: { href: "/community", label: "Visit the community page" } },
];
