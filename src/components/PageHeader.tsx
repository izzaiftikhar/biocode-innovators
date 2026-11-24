export default function PageHeader({
  title,
  intro,
  image,
}: {
  title: string;
  intro?: string;
  image?: string;
}) {
  return (
    <section className="page-hero relative overflow-hidden bg-secondary">
      {image && (
        <>
          <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-secondary via-secondary/80 to-secondary/10"
          />
        </>
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50rem 22rem at 90% -20%, rgb(34 211 238 / 0.25), transparent 60%), radial-gradient(36rem 20rem at 0% 120%, rgb(14 116 144 / 0.4), transparent 60%)",
        }}
      />

      <div className="container-page page-hero__content relative">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          BioCode Innovators
        </p>

        <h1 className="mt-3 max-w-3xl text-4xl font-semibold !text-white sm:text-5xl">
          {title}
        </h1>

        {intro && (
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
            {intro}
          </p>
        )}
      </div>
    </section>
  );
}
