
import Link from "next/link";

export default function NotFound() {
  return (
    <section className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-semibold uppercase tracking-widest text-primary">
        Error 404
      </p>

      <h1 className="mt-4 font-heading text-4xl font-semibold text-ink sm:text-5xl">
        Page not found
      </h1>

      <p className="mt-4 max-w-md text-muted">
        The page you are looking for may have moved, been removed, or is
        temporarily unavailable.
      </p>

      <Link href="/" className="btn mt-8">
        Return to homepage
      </Link>
    </section>
  );
}
