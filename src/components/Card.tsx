import Link from "next/link";

export default function Card({ label, title, children, href, cta, image }: {
  image?: string; label: string; title: string; children?: React.ReactNode; href?: string; cta?: string;
}) {
  return (
    <article className="flex flex-col rounded-lg border border-line border-t-4 border-t-primary bg-bg p-6 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg">
      {image && <img src={image} alt="" loading="lazy" className="mb-4 aspect-[16/10] w-full rounded-md object-cover" />}
      <span className="chip self-start">{label}</span>
      <h3 className="mt-4 text-xl font-semibold">{title}</h3>
      <div className="mt-2 flex-1 text-sm text-muted">{children}</div>
      {href && (
        href.startsWith("http")
          ? <a href={href} target="_blank" rel="noopener noreferrer" className="arrow-link mt-5 text-sm">{cta ?? "Open"} →</a>
          : <Link href={href} className="arrow-link mt-5 text-sm">{cta ?? "Open"} →</Link>
      )}
    </article>
  );
}
