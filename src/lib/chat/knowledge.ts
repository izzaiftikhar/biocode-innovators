import { faqs } from "@/data/faqs";
import { about, founder, site } from "@/data/content";
import { createServerSupabase } from "@/lib/supabase/server";
import { extraKnowledge } from "@/data/chatbot-knowledge";

export type Link = { href: string; label: string };
export type Chunk = { id: string; title: string; text: string; link?: Link };

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; chunks: Chunk[] } | null = null;

/** Called after an admin edits chatbot knowledge so answers update immediately. */
export function clearKnowledgeCache() {
  cache = null;
}

const clip = (value: unknown, max: number) => {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/** Facts that live in code (about, founder, contact, site map, programmes). */
function staticChunks(): Chunk[] {
  const socials = site.socials
    .filter((s) => s.href)
    .map((s) => `${s.label}: ${s.href}`)
    .join("; ");

  return [
    {
      id: "about",
      title: "About BioCode Innovators what is biocode who we are",
      text: `${about.body} ${about.mission} (${about.badge}).`,
      link: { href: "/about", label: "About us" },
    },
    {
      id: "founder",
      title: "Founder who founded started created BioCode Innovators founder name leadership",
      text: `${site.name} was founded by ${founder.name} (${founder.role}). Her headline message: "${founder.headline}". ${founder.note.join(" ")}`,
      link: { href: "/founder", label: "Founder's note" },
    },
    {
      id: "contact",
      title: "Contact email reach phone address social media follow",
      text: `Email: ${site.email}. You can also use the contact form on the website. Social media: ${socials}.`,
      link: { href: "/contact", label: "Contact us" },
    },
    {
      id: "sitemap",
      title: "Website pages sections where find navigate",
      text: "Main pages: About, Research (publications), Courses, Fellowship, Student Journal, Internships, Community, Updates, FAQs, Contact, and a site-wide Search. Signed-in students also have a Dashboard.",
      link: { href: "/faq", label: "FAQs" },
    },
    {
      id: "fellowship",
      title: "Research Fellowship programme mentoring selection output publication",
      text: "The Research Fellowship is a mentored research opportunity for selected students. Its application, selection, mentoring, expected outputs, and completion requirements depend on the specific fellowship announcement. Research publication is not guaranteed; authorship and publication depend on actual contributions and applicable policies. Check the current fellowship announcement for confirmed details.",
      link: { href: "/fellowship", label: "Research Fellowship" },
    },
    {
      id: "community",
      title: "Community membership join members events",
      text: "The community gives members updates, event access and a membership certificate that can be verified online. Join by creating an account.",
      link: { href: "/community", label: "Community" },
    },
  ];
}

function faqChunks(): Chunk[] {
  return faqs.map((f) => ({
    id: `faq-${f.id}`,
    title: `${f.category} ${f.question}`,
    text: f.answer,
    link: f.link,
  }));
}

/** Live content, published rows only, public columns only. A failing table is skipped, not fatal. */
async function databaseChunks(): Promise<Chunk[]> {
  let db;

  try {
    db = createServerSupabase();
  } catch {
    return [];
  }

  const [courses, internships, publications, journals, updates, team, custom] =
    await Promise.all([
      db.from("courses")
        .select("title, summary, level, duration, delivery, is_free")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(25),

      db.from("internships")
        .select("title, department, duration, mode, is_paid, stipend_details, contact_email")
        .eq("published", true)
        .eq("is_open", true)
        .limit(25),

      db.from("publications")
        .select("title, authors, year, journal, type")
        .eq("is_published", true)
        .order("year", { ascending: false, nullsFirst: false })
        .limit(25),

      db.from("student_journals")
        .select("title, student_name, domain, publication_date")
        .eq("is_published", true)
        .order("publication_date", { ascending: false })
        .limit(25),

      db.from("updates")
        .select("title, content, created_at")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(8),

      db.from("about_team_members")
        .select("name, role, bio")
        .eq("is_published", true)
        .order("display_order", { ascending: true })
        .limit(30),

      db.from("chatbot_knowledge")
        .select("id, topic, answer, link_href, link_label")
        .eq("is_published", true)
        .order("updated_at", { ascending: false })
        .limit(200),
    ]);

  const out: Chunk[] = [];

  const log = (name: string, error: { message: string } | null) => {
    if (error) console.error(`Chat knowledge: ${name} failed:`, error.message);
  };

  log("courses", courses.error);
  log("internships", internships.error);
  log("publications", publications.error);
  log("journals", journals.error);
  log("updates", updates.error);
  log("team", team.error);
  log("custom", custom.error);

  // Admin-written facts are approved and specific.
  for (const k of custom.data ?? []) {
    out.push({
      id: `db-kb-${k.id}`,
      title: k.topic,
      text: k.answer,
      link:
        k.link_href && k.link_label
          ? { href: k.link_href, label: k.link_label }
          : undefined,
    });
  }

  if (courses.data?.length) {
    out.push({
      id: "db-courses",
      title: "Courses available list offered catalogue free paid level duration",
      link: { href: "/courses", label: "Browse courses" },
      text:
        "Published courses: " +
        courses.data
          .map(
            (c) =>
              `${c.title} (${[
                c.level,
                c.duration,
                c.delivery,
                c.is_free === false ? "paid" : "free",
              ]
                .filter(Boolean)
                .join(", ")})${c.summary ? ": " + clip(c.summary, 160) : ""}`
          )
          .join("; "),
    });
  }

  // If the query itself fails, do not claim that there are no openings.
  if (!internships.error) {
    const activeInternships = internships.data ?? [];

    if (activeInternships.length) {
      out.push({
        id: "db-internships",
        title: "Internships currently open active positions roles apply stipend paid deadline vacancies",
        link: { href: "/internships", label: "View internships" },
        text:
          "Verified currently open internships (published and marked open): " +
          activeInternships
            .map(
              (i) =>
                `${i.title} (${[
                  i.department,
                  i.duration,
                  i.mode,
                  i.is_paid
                    ? `paid${i.stipend_details ? " - " + clip(i.stipend_details, 80) : ""}`
                    : "unpaid",
                ]
                  .filter(Boolean)
                  .join(", ")})`
            )
            .join("; ") +
          (activeInternships.find((i) => i.contact_email)
            ? `. Contact: ${activeInternships.find((i) => i.contact_email)!.contact_email}`
            : ""),
      });
    } else {
      out.push({
        id: "db-internships",
        title: "Internships currently open active positions roles apply vacancies availability",
        link: { href: "/internships", label: "View internships" },
        text: "There are currently no verified open internships listed. Some previously announced opportunities may have closed. Check the internships page for future announcements or contact the BioCode team.",
      });
    }
  }

  if (publications.data?.length) {
    out.push({
      id: "db-publications",
      title: "Research publications papers journal articles authors published",
      link: { href: "/research", label: "Read the research" },
      text:
        "Recent publications: " +
        publications.data
          .map(
            (p) =>
              `"${clip(p.title, 120)}"${
                Array.isArray(p.authors) && p.authors.length
                  ? " by " + p.authors.slice(0, 3).join(", ")
                  : ""
              }${p.year ? " (" + p.year + ")" : ""}${
                p.journal ? ", " + p.journal : ""
              }`
          )
          .join("; "),
    });
  }

  if (journals.data?.length) {
    out.push({
      id: "db-journal",
      title: "Student Journal student work papers featured",
      link: { href: "/student-journal", label: "Student Journal" },
      text:
        "Student Journal entries: " +
        journals.data
          .map(
            (j) =>
              `"${clip(j.title, 100)}" by ${j.student_name}${
                j.domain ? " (" + j.domain + ")" : ""
              }`
          )
          .join("; "),
    });
  }

  if (updates.data?.length) {
    out.push({
      id: "db-updates",
      title: "Updates news announcements latest recent",
      link: { href: "/updates", label: "Latest updates" },
      text:
        "Latest updates: " +
        updates.data
          .map((u) => `${u.title}${u.content ? " - " + clip(u.content, 140) : ""}`)
          .join("; "),
    });
  }

  if (team.data?.length) {
    out.push({
      id: "db-team",
      title: "Team members people mentors leadership staff who works",
      link: { href: "/about", label: "Meet the team" },
      text:
        "Team: " +
        team.data
          .map(
            (m) =>
              `${m.name} (${m.role})${m.bio ? ": " + clip(m.bio, 120) : ""}`
          )
          .join("; "),
    });
  }

  return out;
}

/** All approved knowledge: code facts + FAQs + live published content (cached 5 minutes). */
export async function getKnowledge(): Promise<Chunk[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.chunks;

  const live = await databaseChunks().catch(() => [] as Chunk[]);
  const chunks: Chunk[] = [
    ...extraKnowledge,
    ...staticChunks(),
    ...live,
    ...faqChunks(),
  ];

  cache = { at: Date.now(), chunks };
  return chunks;
}

// ---------- Retrieval ----------

const STOP = new Set([
  "the", "a", "an", "is", "are", "to", "do", "does", "did", "i", "how",
  "what", "can", "my", "me", "of", "for", "and", "in", "on", "it", "you",
  "we", "your", "about", "with", "get", "who", "where", "when", "which",
  "there", "any", "tell", "please", "site", "website", "have", "has", "be",
  "or", "at", "this", "that", "us", "our", "was", "were", "isnt", "not",
]);

function normalise(word: string): string {
  let w = word.toLowerCase();

  if (w.startsWith("enroll")) w = w.replace(/^enroll/, "enrol");

  const aliases: Record<string, string> = {
    founded: "founder",
    founding: "founder",
    creator: "founder",
    created: "founder",
    started: "founder",
    publications: "publication",
    published: "publication",
    publishing: "publication",
    guarantee: "guarantee",
    guarantees: "guarantee",
    guaranteed: "guarantee",
    guaranteeing: "guarantee",
    papers: "research",
    paper: "research",
    articles: "publication",
    article: "publication",
  };

  if (aliases[w]) return aliases[w];

  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) {
    return w.slice(0, -1);
  }

  return w;
}

export function tokens(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 1 && !STOP.has(w))
        .map(normalise)
    )
  );
}

function intentBoost(id: string, title: string, question: string): number {
  const q = question.toLowerCase();
  const key = `${id} ${title}`.toLowerCase();

  const asksFounder =
    /\b(founder|founded|founding|creator|created|started|who established)\b/.test(q);

  const asksJoining =
    /\b(join|joining|apply|application|enrol|enroll|register|registration)\b/.test(q) &&
    /\b(biocode|community|organisation|organization|team|programme|program|course|us)\b/.test(q);

  const asksPublicationPolicy =
    /\b(publication|publish|published|paper|papers|authorship|author|guarantee|guaranteed|guarantees)\b/.test(q) &&
    /\b(guarantee|guaranteed|guarantees|ensure|promise|sure|always|will|can)\b/.test(q);

  let boost = 0;

  if (asksFounder && /\bfounder\b/.test(key)) {
    boost += 100;
  }

  if (asksJoining && /joining-process/.test(id)) {
    boost += 120;
  }

  if (asksJoining && /community/.test(id)) {
    boost += 20;
  }

  if (
    asksPublicationPolicy &&
    /(research-publication-authorship|publication|authorship|chatbot-accuracy-rules)/.test(key)
  ) {
    boost += 100;
  }

  if (
    asksPublicationPolicy &&
    /\b(publication|authorship|guarantee)\b/.test(key)
  ) {
    boost += 25;
  }

  return boost;
}

export function search(chunks: Chunk[], question: string, max = 3) {
  const words = tokens(question);
  if (!words.length) return [];

  const docs = chunks.map((chunk) => ({
    chunk,
    // Include the ID so entries such as "joining-process" are searchable.
    titleWords: new Set(tokens(`${chunk.id} ${chunk.title}`)),
    textWords: new Set(tokens(chunk.text)),
  }));

  const idf = new Map(
    words.map((word) => {
      const df = docs.filter(
        (doc) => doc.titleWords.has(word) || doc.textWords.has(word)
      ).length;

      return [word, Math.log(1 + docs.length / (1 + df))] as const;
    })
  );

  return docs
    .map((doc) => {
      let score = 0;
      let titleHits = 0;

      for (const word of words) {
        const weight = idf.get(word) ?? 0;

        if (doc.titleWords.has(word)) {
          score += 5 * weight;
          titleHits++;
        } else if (doc.textWords.has(word)) {
          score += 2 * weight;
        }
      }

      if (doc.chunk.id.startsWith("db-")) {
        score *= 1.2;
      }

      score += intentBoost(doc.chunk.id, doc.chunk.title, question);

      return {
        chunk: doc.chunk,
        score,
        titleHits,
      };
    })
    .filter((result) => result.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.titleHits - a.titleHits
    )
    .slice(0, max);
}

const GREETING =
  /^(hi|hello|hey|salam|assalam[ -]?o[ -]?alaikum|good (morning|afternoon|evening)|thanks|thank you|ok|okay)\b/i;

export const isGreeting = (q: string) =>
  GREETING.test(q.trim()) && q.trim().length < 40;

export const FALLBACK = {
  reply: `I'm not sure about that one, but the BioCode team can help. You can email ${site.email} or use the contact form.`,
  links: [{ href: "/contact", label: "Contact us" }] as Link[],
};
