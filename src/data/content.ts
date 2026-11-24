// Placeholder content. The client will supply the real publications,
// courses, team and internships. Later, move this to the database.

export type Publication = {
  slug: string; title: string; authors: string[]; year: number;
  journal: string; doi?: string; url: string; abstract: string;
  type: "Article" | "Review" | "Conference"; tags: string[]; image?: string;
};

export const publications: Publication[] = [
  {
    slug: "sample-publication-one",
    title: "Sample publication title goes here",
    authors: ["Author One", "Author Two"],
    year: 2026, journal: "Journal Name", doi: "10.0000/sample.0001",
    url: "https://example.org/paper-1",
    abstract: "A short abstract of two or three sentences describing the study and its main finding.",
    type: "Article", tags: ["Marine biology", "Bioinformatics"], image: "/images/card-1.jpg",
  },
  {
    slug: "sample-publication-two",
    title: "Second sample publication title",
    authors: ["Author Three"],
    year: 2025, journal: "Another Journal", url: "https://example.org/paper-2",
    abstract: "Replace this with the real abstract provided by the research team.",
    type: "Review", tags: ["Genomics"], image: "/images/card-2.jpg",
  },
];

export type Course = {
  slug: string; title: string; summary: string; level: "Beginner" | "Intermediate" | "Advanced";
  duration: string; modules: number; delivery: "YouTube" | "Live" | "Mixed"; price: "Free" | "Paid";
  syllabus: string[]; learn: string[];
};

export const courses: Course[] = [
  { slug: "intro-to-bioinformatics", title: "Introduction to Bioinformatics", summary: "Core ideas and first hands-on analysis, taught module by module.", level: "Beginner", duration: "6 weeks", modules: 8, delivery: "YouTube", price: "Free",
    syllabus: ["What is bioinformatics?","Biological databases","Sequence basics","Alignment","Intro to Python for biology","Reading a research paper","Mini project","Final review"],
    learn: ["Core bioinformatics vocabulary","How to search biological databases","Running your first sequence analysis"] },
  { slug: "research-writing", title: "Research Writing for Students", summary: "From a research question to a short publishable paper.", level: "Beginner", duration: "4 weeks", modules: 6, delivery: "Mixed", price: "Free",
    syllabus: ["Choosing a research question","Finding and reading papers","Structuring a short paper","Writing the abstract","Citations and references","Final draft"],
    learn: ["Turn an idea into a research question","Write a clear short paper","Prepare work for the Student Journal"] },
];

export type JournalEntry = {
  slug: string; title: string; authors: string[]; date: string;
  summary: string; tags: string[]; url: string; image: string;
};

// Sample entries: replace with real student work (the admin panel will manage these).
export const journalEntries: JournalEntry[] = [
  { slug: "sample-entry-one", title: "Sample student paper title", authors: ["Student Name"], date: "2026-09-12", summary: "A two-line summary of the student's work and what it found.", tags: ["Biology"], url: "https://example.org/journal-1", image: "/images/card-3.jpg" },
  { slug: "sample-entry-two", title: "Second sample journal entry", authors: ["Student Name", "Student Name"], date: "2026-08-20", summary: "Replace this with the real summary supplied by the author.", tags: ["Data analysis"], url: "https://example.org/journal-2", image: "/images/card-4.jpg" },
  { slug: "sample-entry-three", title: "Third sample journal entry", authors: ["Student Name"], date: "2026-07-05", summary: "Short summary text goes here for the third sample entry.", tags: ["Genomics"], url: "https://example.org/journal-3", image: "/images/card-5.jpg" },
];

export const about = {
  tag: "About BioCode Innovators",
  title: "BioCode Innovators",
  body: "BioCode Innovators is a scientific learning and research platform dedicated to advancing education and innovation in bioinformatics, computational biology, biotechnology, and artificial intelligence. We provide hands-on training, research opportunities, workshops, and collaborative projects that empower students and researchers to develop practical skills, contribute to scientific research, and build strong professional portfolios.",
  mission: "Our mission is to bridge the gap between academic learning and real-world research by fostering a global community of future scientists and innovators.",
  badge: "Advanced Computational & Research Hub",
  image: "/images/about.jpg",
};

export const founder = {
  name: "Abeera Iftikhar",
  role: "Founder, BioCode Innovators",
  image: "/images/founder.png",
  headline: "Empowering the Future of Computational Biology",
  note: [
    "At BioCode Innovators, our vision has always been to break down barriers between theoretical life sciences and practical coding. By equipping students with hands-on virtual lab experiences and robust bioinformatics frameworks, we are building a resilient generation of researchers ready to make global impacts.",
  ],
};

export type Update = { slug: string; title: string; date: string; category: string; summary: string };

export const updates: Update[] = [
  { slug: "site-launch", title: "The research wing website is being built", date: "2026-10-08", category: "News", summary: "Courses, publications and the fellowship will be added in phases." },
];

export type TeamMember = { name: string; role: string; bio: string };
export const team: TeamMember[] = [
  { name: "Team Member Name", role: "Research Lead", bio: "Short bio, credentials and profile links will go here." },
  { name: "Team Member Name", role: "Mentor", bio: "Short bio, credentials and profile links will go here." },
];

export const internships = [
  { title: "Research Intern", department: "Research", duration: "8 weeks", mode: "Remote", paid: false, status: "Open" as const },
  { title: "Content and Outreach Intern", department: "Communications", duration: "6 weeks", mode: "Remote", paid: true, stipend: "Details on request", status: "Open" as const },
];

export const site = {
  name: "Biocode Innovators",
  wing: "Research Wing",
  email: "biocodeinnovators13@gmail.com",
  socials: [
    // Replace each href with the real Biocode page URL.
    { label: "LinkedIn", href: "https://www.linkedin.com/company/biocode-innovators/" },
    { label: "YouTube", href: "https://www.youtube.com/@BIOCODEINNOVATORS" },
    { label: "Instagram", href: "https://www.instagram.com/biocodeinnovators/" },
  ],
};
