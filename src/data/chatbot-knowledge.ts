
export type ExtraKnowledgeChunk = {
  id: string;
  title: string;
  text: string;
  link?: { href: string; label: string };
};

export const extraKnowledge: ExtraKnowledgeChunk[] = [
  {
    id: "biocode-overview",
    title: "BioCode Innovators Overview About Organization Mission Vision Tagline",
    text: `
BioCode Innovators is an online educational, scientific, research, and collaborative learning initiative connecting biology, computing, artificial intelligence, and data-driven problem-solving.

Official tagline: Code Your Future. Decode Biology.
Core areas: Bioinformatics, AI, Data Analytics.
Learning philosophy: Learn, Research, Innovate.

BioCode Innovators creates opportunities for students, researchers, and aspiring professionals to develop practical skills, understand scientific workflows, collaborate, and work on educational or research-oriented projects.

Its learning philosophy is:
Learn → Understand → Plan → Research → Collaborate → Build → Review → Produce → Document → Demonstrate.

The organization emphasizes practical understanding and documented work rather than limiting learning to watching lectures or collecting certificates.

BioCode Innovators operates online. Programs, activities, workshops, learning resources, and collaborative work are delivered through digital platforms and online communication.

Bio means biology, biotechnology, life sciences, and related scientific fields.
Code means programming, computational approaches, data analysis, and digital technologies.
Innovators represents applying knowledge creatively to develop ideas, projects, research outputs, and practical solutions.

BioCode Innovators is not a university, degree-awarding institution, physical campus, laboratory, or in-person training center. Do not claim that it offers university degrees, professional licenses, or physical laboratory access.
`,
    link: { href: "https://biocode-innovators.vercel.app/", label: "Official website" },
  },
  {
    id: "biocode-mission-vision",
    title: "BioCode Innovators Mission Vision Values What Makes It Different",
    text: `
Mission: BioCode Innovators aims to make scientific and computational learning more accessible and practical through online education, research exposure, interdisciplinary collaboration, and project-based development.

Its approach emphasizes accessible education, practical learning, research awareness, scientific communication, responsible documentation, collaboration, digital portfolios, and integration of biology, computing, AI, and data analytics.

Vision: Encourage a learning and research culture in which people move from understanding concepts to applying knowledge, collaborating, creating meaningful work, and documenting progress.

BioCode Innovators emphasizes the connection between learning and doing. Participants may explore scientific concepts, research questions, methodologies, collaborative activities, manuscripts, research handouts, presentations, visual materials, code, and other outputs depending on the activity.

Not every participant or program includes all these activities. Deliverables and benefits depend on the specific course, fellowship, workshop, project, or team role.
`,
  },
  {
    id: "who-can-join",
    title: "Who Can Join BioCode Innovators Eligibility Beginners Students Background",
    text: `
BioCode Innovators may be relevant to students in biotechnology, biological sciences, bioinformatics, computational biology, computer science, software development, data science, AI, machine learning, biomedical sciences, and related disciplines.

It may also be relevant to researchers strengthening research methodology or scientific communication, beginners exploring bioinformatics, and people interested in scientific writing, data visualization, design, development, media, communication, management, or community engagement.

Beginners can explore introductory educational opportunities when available. Advanced programming knowledge is not necessarily required to begin learning bioinformatics. Introductory activities may cover biological databases, biological sequences, scientific concepts, and basic analytical workflows.

Advanced courses, research projects, and team positions may have prerequisites.

Not every activity requires a biology degree. Computing and data science students may explore computational biology, while biotechnology students may develop programming and data-analysis skills.

Eligibility must always be checked separately for the specific opportunity. Do not imply that every program accepts every background or international participant.
`,
  },
  {
    id: "online-format",
    title: "Online Learning Remote Participation International Students Relocation",
    text: `
BioCode Innovators operates online. Learning materials, online sessions where applicable, remote collaboration, announcements, and digital submissions are delivered through online platforms.

No relocation is required for online activities. Participants need access to the relevant digital platforms and any technical resources required by their program.

Online delivery may make participation possible from different locations, but international eligibility, time zones, payment arrangements, and participation requirements must be checked for each program.

Some previously offered recorded programs used arrangements for participants with substantial time-zone differences. Do not assume those arrangements apply to future programs.

Do not advertise physical classes, campus facilities, in-person laboratory access, or face-to-face meetings unless a specific official announcement confirms them.
`,
  },
  {
    id: "subject-bioinformatics",
    title: "Bioinformatics Courses Topics Biological Databases Sequence Analysis BLAST",
    text: `
Bioinformatics involves using computational tools and data-analysis methods to understand biological information.

Relevant learning areas may include biological databases, DNA and protein sequence retrieval, biological sequence analysis, sequence alignment, protein structure and function, molecular docking and related computational workflows, biological data interpretation, and computational analysis of scientific questions.

The exact tools and techniques taught depend on the specific course or project.

Bioinformatics connects biological knowledge with computational approaches. A student may, for example, retrieve biological sequences from a database and use computational tools to compare or analyze them.
`,
  },
  {
    id: "subject-computational-ai-data",
    title: "Computational Biology Artificial Intelligence Machine Learning Data Analytics",
    text: `
Computational biology uses mathematical, statistical, and computational approaches to investigate biological systems. Related areas may include biological data analysis, modeling, molecular biology applications, computational research workflows, and interdisciplinary problem-solving.

BioCode Innovators recognizes AI and machine learning as relevant to computational and data-driven scientific work. Potential learning directions include AI and machine learning foundations, data preparation, model evaluation, predictive modeling, AI applications in biological research, and responsible use of AI.

Data analytics involves organizing, examining, interpreting, and communicating information. Relevant skills may include data handling, analytical reasoning, interpretation of results, and data visualization.

These are broad subject areas and do not guarantee that each topic is currently offered as a separate course.
`,
  },
  {
    id: "subject-research-writing",
    title: "Research Methodology Scientific Writing Literature Review Manuscripts",
    text: `
Research methodology concerns how research questions are developed, investigated, documented, and communicated.

Learning areas may include identifying research problems, formulating research questions, reviewing literature, selecting research approaches, developing protocols, organizing data and evidence, synthesizing findings, preparing scientific reports and manuscripts, referencing, and responsible scientific writing.

Scientific communication helps researchers present complex information accurately and clearly. Related activities may cover scientific writing, literature analysis, manuscript structure, research summaries, scientific presentations, posters, infographics, data visualization, AI-assisted writing, and research documentation.

Specific topics depend on the relevant program.
`,
  },
  {
    id: "subject-creative-technical-roles",
    title: "Design Development Media Video Editing Social Media HR Management Roles",
    text: `
BioCode Innovators recognizes contributions beyond scientific analysis.

Depending on available opportunities, work may involve graphic design, scientific visuals, educational content, website and software development, digital media, video editing, social media communication, project coordination, human resources, community engagement, team management, and administration.

The multidisciplinary approach allows people with different skills to contribute to suitable activities.

These are possible organizational functions, not a declaration that every role is currently vacant.
`,
  },
  {
    id: "program-types",
    title: "BioCode Innovators Courses Bootcamps Workshops Fellowships Research Internships",
    text: `
BioCode Innovators may offer different types of educational and collaborative activities.

Courses provide structured opportunities to learn a subject through lessons, learning resources, activities, or assignments. They may be live, recorded, or a combination. Some programs may be free while others may have fees or optional paid components.

Bootcamps are focused learning programs organized around a subject or set of skills. They may include sessions, recordings, demonstrations, assignments, resources, attendance requirements, completion criteria, and certificates where applicable.

Workshops are focused educational events introducing or exploring a particular topic. Duration, speaker, format, registration, recording, and certificate arrangements vary.

Research methodology fellowships may provide exposure to research planning, literature review, scientific protocols, manuscript preparation, research documentation, data handling, and scientific reporting.

Collaborative research projects may involve defining research questions, reviewing literature, selecting methods, analyzing information, preparing visuals, writing scientific documents, reviewing work, and documenting contributions.

Internships and team opportunities may involve scientific, educational, technical, creative, administrative, or community-oriented work.

Project-based learning connects learning with a defined output such as computational analysis, research handouts, presentations, manuscripts, data visualizations, educational resources, software projects, or scientific communication.

The exact responsibilities, eligibility, duration, fees, compensation, deliverables, and certificates must come from the relevant official announcement. Do not assume an opportunity is currently available.
`,
  },
  {
    id: "historical-bioinformatics-bootcamp",
    title: "Historical Bioinformatics Bootcamp Batch 2 September October 2026",
    text: `
HISTORICAL PROGRAM — NOT CURRENTLY CONFIRMED OPEN.

BioCode Innovators previously organized Bioinformatics Bootcamp Batch 2 as part of its free-course activities.

The documented orientation took place on 2 September 2026. The documented completion period ran from 1 September to 1 October 2026, with sessions scheduled during September.

Topics included biological databases, biological data retrieval, DNA and protein sequence analysis, the relationship between biological sequences and structure, pairwise sequence alignment, multiple sequence alignment, molecular docking, and related computational analysis.

The program used recorded learning resources and assignments.

Historical orientation recording:
https://www.youtube.com/watch?v=GB5Qy1b6O5Y

Historical registration form:
https://forms.gle/xS9bkSkXTQxWfRUQ8

The documented batch period has ended. Never present its old registration form or schedule as a currently open enrollment opportunity unless a new official announcement confirms that the same link is being reused.
`,
    link: { href: "https://github.com/biocode-innovators/Bioinformatics-Bootcamp-2026", label: "Bootcamp repository" },
  },
  {
    id: "historical-scientific-writing",
    title: "Historical Scientific Content Writing Biotechnology Bioinformatics AI Batch 2 Fee",
    text: `
HISTORICAL PROGRAM — NOT CURRENTLY CONFIRMED OPEN.

BioCode Innovators previously offered Scientific Content Writing for Biotechnology, Bioinformatics and AI — Batch 2.

Documented topic areas included scientific writing, literature analysis, AI communication, posters, infographics, presentations, responsible AI-assisted writing, and scientific communication for biotechnology, bioinformatics, and AI.

The historical program included a free learning option and an optional portfolio-and-certificate package listed at PKR 799 or USD 5.

Historical free-only registration form:
https://forms.gle/62uqy3q35VibWGg6wG6

The documented completion period ran from 1 September to 1 October 2026.

These prices and arrangements are historical only. Do not quote them as current fees or claim that registration is open without a current official announcement confirming the terms.
`,
    link: { href: "https://scientific-content-writing-bootcamp.vercel.app/", label: "Program-related resource" },
  },
  {
    id: "historical-research-fellowship",
    title: "Historical Research Methodology Fellowship September October 2026",
    text: `
HISTORICAL PROGRAM — COMPLETED.

BioCode Innovators previously conducted a one-month Research Methodology Fellowship from 10 September to 10 October 2026.

Documented training areas included research methodologies, problem formulation, systematic literature review, data handling and synthesis, scientific protocols, research reporting, visual presentation of findings, manuscript structure and preparation, discussion, conclusion, abstract writing, research documentation, and responsible scientific writing.

The fellowship included team-based activities and research-related deliverables.

This fellowship period has ended. Future fellowships must be described using their own official announcements. Do not reuse the historical dates, requirements, or terms as current information.
`,
  },
  {
    id: "historical-workshops",
    title: "Previous BioCode Innovators Workshops Genomics Personalized Medicine In Silico Biology",
    text: `
BioCode Innovators has worked on workshops related to genomics, personalized medicine, and the emergence of in silico biology in Pakistan.

The availability, date, recording, speaker, registration requirements, and certificate arrangements for a specific workshop must be confirmed through its official announcement.

Do not invent an upcoming workshop or reuse a historical workshop date as a current event.
`,
  },
  {
    id: "joining-process",
    title: "How to Join Register Courses Bootcamps Workshops Fellowships Research Team",
    text: `
The joining process depends on the type of opportunity.

For a course or bootcamp: find the relevant official announcement, read the description and eligibility requirements, check fees, complete the official registration form, follow the instructions received after registration, and review the learning format, assignments, attendance, and completion criteria.

For a workshop: find the official event announcement, check topic, date, format, and registration requirements, register if required, and follow the instructions for joining or accessing recordings.

For a fellowship or research project: read the opportunity description, check background requirements, deliverables, and commitment, follow the application or selection process, and wait for official confirmation and instructions.

For an organizational team role: find a current recruitment announcement, read responsibilities and eligibility, submit the requested application or portfolio, and wait for the selection decision.

One general registration form does not enroll someone in every program. Do not invent application links or imply that registration guarantees selection.
`,
  },
  {
    id: "after-registration",
    title: "After Registration Confirmation Instructions Learning Platform Group Access",
    text: `
After registration, the process varies by program.

Registered students may receive instructions about learning resources, session links, recordings, assignments, attendance, communication groups, deadlines, certificates, or access to a learning platform.

Do not promise that every student is automatically added to a group, receives an immediate email, or gets instant platform access.

If a student has registered but has not received instructions, direct them to the contact email or the official contact route in the program announcement.
`,
  },
  {
    id: "learning-attendance-assignments",
    title: "Live Recorded Sessions Self Paced Learning Attendance Assignments Late Submission",
    text: `
BioCode Innovators has used both live and recorded learning formats. The format depends on the particular program. Some activities provide recordings, some use scheduled online sessions, and others combine both.

Recorded programs may provide flexibility, but students may still need to meet assignment deadlines, attendance requirements, or completion conditions. Do not describe every program as fully self-paced.

Some programs use assignments as part of learning or completion. Whether an assignment is compulsory depends on the program's stated rules.

Attendance procedures vary. Historically, some activities used online participation records, email-based instructions, or other program-specific procedures. Watching a recording does not automatically mean attendance has been recorded.

Late submission, extensions, batch transfers, deferment, missed sessions, and alternative attendance arrangements depend on the specific program rules. Do not promise an extension, transfer, or adjustment without official confirmation.

International participants should check the program's time zone and delivery format. Recordings may help when live attendance is not possible, but any alternative attendance or submission process must be confirmed for that program.
`,
  },
  {
    id: "certificates",
    title: "Certificates Participation Completion Service Eligibility Issuance Correction",
    text: `
Some BioCode Innovators programs provide certificates under their stated terms. Certificate type and eligibility depend on the specific activity.

A participation certificate generally recognizes participation in an event or activity.
A completion certificate recognizes that specified completion requirements have been met.
A certificate of service may recognize service in an organizational role after relevant service requirements are fulfilled.
A research project completion certificate, where offered, is governed by actual project completion criteria.

Certificates are not necessarily automatic. Students may need to meet attendance, assignment, participation, submission, or other completion requirements.

Issuance timelines vary by program. If no official timeline is available, do not invent one.

For a certificate issue, correction, or reissue, direct the student to the official program contact. They may need to provide their name, registered email, program name, and relevant non-sensitive details.

A program certificate is not a university degree or professional license unless the issuing arrangement explicitly establishes that status. A certificate does not guarantee employment, admission, academic credit, or professional recognition.
`,
  },
  {
    id: "research-workflow",
    title: "Research Projects Workflow Teams Deliverables Team Lead Responsibilities",
    text: `
Research activities are organized around defined questions, objectives, methods, responsibilities, and deliverables.

Depending on the project, participants may review literature, formulate a research problem, plan methodology, prepare protocols, analyze data or evidence, develop visuals, write scientific documents, and review their work.

Some activities are individual, while collaborative projects may use teams with designated responsibilities.

Possible deliverables include a research manuscript or draft, research handout, slide presentation, literature review, protocol, figures, tables, supporting documentation, data-analysis outputs, and project progress records. The project instructions determine what is compulsory.

A team lead coordinates work according to assigned responsibilities. This may include understanding objectives, dividing tasks, coordinating members, tracking progress and deadlines, identifying delays, reviewing submissions for completeness, coordinating revisions, communicating with supervisors, and submitting collective deliverables.

A team lead is not automatically authorized to make every scientific, authorship, or publication decision independently.
`,
  },
  {
    id: "research-publication-authorship",
    title: "Research Publication Guarantee Journal Acceptance Authorship First Author",
    text: `
Research activities may involve preparing work intended for submission or further scientific development, depending on the project's purpose.

Publication is never guaranteed merely because someone joins a project. Publication depends on work quality and suitability, research integrity, journal or conference requirements, editorial decisions, and peer review where applicable.

Never guarantee journal acceptance, indexing, journal ranking, publication dates, first authorship, corresponding authorship, or a specific authorship position.

Authorship should reflect actual scholarly contributions and applicable project and publication policies. Participants should follow the project's stated authorship and contribution procedures and discuss questions with the authorized research supervisor or project lead.

Some research activities may suit beginners, while others require prior experience. Students should check project prerequisites and expectations.

BioCode Innovators' internal educational and scientific projects should not automatically be described as paid client assignments. Compensation must be confirmed separately for a specific opportunity that expressly provides it.
`,
  },
  {
    id: "team-roles",
    title: "Team Membership Recruitment HR Social Media Design Development Volunteer Paid Roles",
    text: `
When suitable positions or projects are available, people may contribute through roles involving science, education, technology, communication, creativity, coordination, or community engagement.

Possible functions include human resources, secretary or joint secretary responsibilities, management and coordination, social media, ambassadors and community outreach, graphic design, video editing, development, communication coordination, educational and scientific content, research-related support, and administration.

These are possible organizational functions, not confirmation that every position is currently vacant.

Applicants should locate a current recruitment announcement and follow its instructions. Applications may request experience, skills, work samples, portfolios, or other relevant information.

Compensation varies by opportunity. Internal volunteer and collaborative roles must not be represented as paid employment unless a specific announcement explicitly confirms compensation.

Team certificate arrangements are governed by the applicable handbook and appointment terms. BioCode Innovators has established team-policy plans associating a Certificate of Service with completion of the relevant initial service term. Consult the current approved handbook before quoting tenure requirements or promising issuance.

The established policy framework states that department leads report to the Joint Secretary, while HR and the Social Media Manager may escalate matters directly to the Founder. Confirm current arrangements against the approved handbook.

Team expectations depend on role and appointment terms and may include completing assigned work, professional communication, deadlines, respectful collaboration, following procedures, and documenting progress.
`,
  },
  {
    id: "founder",
    title: "Founder Abeera Iftikhar Founder Lead Fellowship Researcher",
    text: `
BioCode Innovators was founded by Abeera Iftikhar.

Official title in current organizational materials:
Abeera Iftikhar — Founder & Lead Fellowship Researcher, BioCode Innovators.

Her professional focus within the organization includes bioinformatics, research, computational biology, and interdisciplinary scientific learning.

Official LinkedIn:
https://www.linkedin.com/in/abeeraiftikhar/

Do not invent additional personal biography, qualifications, employment history, awards, or professional affiliations.
`,
    link: { href: "https://www.linkedin.com/in/abeeraiftikhar/", label: "Founder's LinkedIn" },
  },
  {
    id: "fees",
    title: "Fees Free Courses Paid Programs Optional Certificates Scholarships Financial Assistance",
    text: `
Some BioCode Innovators programs have been offered free of charge. Other programs or optional components may have fees.

Certificate arrangements depend on the program. Some programs may include certificates under their completion conditions, while others may offer separate paid certificates or portfolio options.

Students should check the current announcement or registration form to understand the exact fee, currency, included services, learning resources, certificate arrangements, and payment terms.

Never assume all future programs are free. Never quote an old price as a current fee without confirmation.

Scholarships, fee waivers, discounts, refunds, and financial assistance may only be confirmed when an official announcement establishes that they are available.

Never invent payment accounts, payment methods, discounts, refund policies, scholarships, or fee waivers. If a fee is unclear, direct the student to biocodeinnovators13@gmail.com.
`,
  },
  {
    id: "official-links",
    title: "Official BioCode Innovators Website YouTube Instagram GitHub Contact Email",
    text: `
Official website:
https://biocode-innovators.vercel.app/

YouTube:
https://www.youtube.com/@BioCodeInnovators

Instagram:
https://www.instagram.com/biocodeinnovators/

GitHub organization:
https://github.com/biocode-innovators

Bioinformatics Bootcamp repository:
https://github.com/biocode-innovators/Bioinformatics-Bootcamp-2026

Bioinformatics Bootcamp Batch application resource:
https://bioinformatics-bootcamp-2026-batch.vercel.app/

Scientific Content Writing Bootcamp application resource:
https://scientific-content-writing-bootcamp.vercel.app/

BioCode workspace/login:
https://biocodeinnovators.pythonanywhere.com/

Official contact email:
biocodeinnovators13@gmail.com

The website is the primary starting point for learning about the organization and finding official resources. YouTube may contain educational videos, recordings, workshops, and orientations. Instagram may contain announcements and educational content. GitHub may contain published repositories, code, and project resources.

A recording or repository does not necessarily mean a related program is currently open for registration.

The Bootcamp and Scientific Content Writing application URLs are program-related digital resources. Check their current contents and functionality before describing them as active registration portals.

Direct students to the workspace only when relevant program instructions require it. Never request or handle passwords in chat.

For general inquiries, students may email biocodeinnovators13@gmail.com. They should state their question and, where relevant, program name, registered email, or application reference.
`,
    link: { href: "https://biocode-innovators.vercel.app/", label: "Official website" },
  },
  {
    id: "faq-institution",
    title: "FAQ Is BioCode a University Degree Institution Job Placement",
    text: `
BioCode Innovators is not a university or degree-awarding institution. It provides online educational and collaborative opportunities according to announced programs.

Do not advertise undergraduate degrees, postgraduate degrees, or formal qualifications unless an official source explicitly confirms them.

Do not promise job placement. Educational and project-based activities may help participants develop skills and document their work, but employment outcomes depend on many factors.

Certificates are not automatically equivalent to academic degrees or professional licenses.
`,
  },
  {
    id: "faq-student",
    title: "FAQ Beginner Coding Experience Laptop Requirements International Students",
    text: `
Beginners can explore beginner-oriented opportunities when available. Check the prerequisites of the particular program.

Technical requirements vary. Some learning activities may be possible through a browser or recorded lessons, while programming and computational projects may require access to a suitable computer and software. Check the specific program requirements before giving a definitive answer about laptop or software requirements.

Online delivery may make participation possible from outside Pakistan, but eligibility, time zone, payment terms, and participation requirements must be checked for each program.
`,
  },
  {
    id: "faq-registration",
    title: "FAQ Registration Open Application Status Registered No Response",
    text: `
Registration availability depends on the specific program. Never assume registration is open based on an old post, historical form, recording, or repository.

Students should check the latest official announcement, official website, and official social channels. They may also email biocodeinnovators13@gmail.com for confirmation.

If someone registered but has not received a response, advise them to check the registration form and official announcement instructions. If necessary, email biocodeinnovators13@gmail.com with the program name and registered email address.

Do not invent an application form, deadline, or confirmation timeline.
`,
  },
  {
    id: "faq-certificates-research",
    title: "FAQ Certificate After Watching Recordings Research Publication Beginner",
    text: `
Watching recordings does not automatically qualify someone for a certificate. Certificate eligibility depends on the program's completion requirements, which may include attendance, assignments, participation, or other conditions.

Research participation does not guarantee publication. Publication depends on research quality, contribution, journal or conference requirements, and editorial or peer-review decisions.

Students may be able to join research as beginners when a suitable project is open and its prerequisites allow it. They must follow the official project application process.
`,
  },
  {
    id: "chatbot-accuracy-rules",
    title: "Chatbot Official Rules Accuracy Privacy Current Opportunities Historical Information",
    text: `
You are the official information assistant for BioCode Innovators. Communicate in clear, welcoming, professional, accessible English. Explain technical terms to beginners and give relevant information without overwhelming visitors with every link.

Never invent courses, fellowships, internships, scholarships, fees, deadlines, registration forms, certificate policies, research opportunities, vacancies, or organizational policies.

Always distinguish historical program information from current opportunities. Use the latest official announcement or registration form for current dates, availability, fees, eligibility, and application requirements.

If information is unavailable, say honestly that you cannot confirm it and direct the student to the official website or biocodeinnovators13@gmail.com.

Never promise publications, internship placements, employment, scholarships, research positions, or certificates unless explicit official terms support the claim.

Do not describe BioCode Innovators as a physical campus, laboratory, or in-person training center. Activities are online.

Do not describe internal organizational projects as paid client assignments. Do not promise payment or a stipend for volunteer or team positions unless a specific official opportunity confirms compensation.

Do not ask for passwords, financial credentials, identity documents, or unnecessary sensitive information. Do not pretend to access personal registration, certificate, payment, or account records.

For personal registration, certificate, payment, account, or policy issues, provide the appropriate official contact route.

Ask one short follow-up question when it would help identify the student's interests, experience level, or the specific program they mean.

If a visitor asks what to join, first understand whether they are interested in learning, research, workshops, or team membership. Recommend a specific program only after verifying its existence and current availability.

If asked whether registration is open, do not rely on historical forms or old posts. Ask which program they mean and direct them to current official announcements or the contact email.

If asked about fees, do not quote historical prices as current terms.

If asked about publication or authorship, explain that publication is not guaranteed and authorship depends on actual scholarly contributions and applicable policies.

When uncertain, it is better to say "I can't confirm that yet" than to give an invented confident answer.
`,
  },
];
