import type { Advice, Language } from "@capella/shared";
import { pickLang } from "@capella/shared";

export function AdviceSection({ advices, lang, dict }: { advices: Advice[]; lang: Language; dict: any }) {
  if (advices.length === 0) return null;
  const isAr = lang === "ar";

  return (
    <section className="mt-16 mb-24">
      <header className="mb-10 grid gap-2 border-t border-(--hairline) pt-12">
        <span className="eyebrow text-accent!">{dict.advices.eyebrow}</span>
        <h2 className={isAr
          ? "m-0 text-[clamp(26px,2.6vw,38px)] font-bold font-(family-name:--font-ar) leading-tight text-ink"
          : "m-0 text-[clamp(28px,2.8vw,40px)] font-(--font-display) leading-[1.1] tracking-[-0.005em] text-ink"}>
          {dict.advices.title}
        </h2>
        <p className="max-w-[58ch] text-base leading-[1.7] text-(--ink-2)">{dict.advices.description}</p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7">
        {advices.map((advice) => (
          <article
            key={advice.id}
            className="group grid overflow-hidden rounded-lg border border-(--hairline) bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-warm hover:shadow-(--shadow-2)"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-[radial-gradient(120%_120%_at_50%_0%,var(--warm-soft),var(--surface))]">
              {advice.imagePath ? (
                <img
                  src={advice.imagePath}
                  alt={pickLang(advice.title, lang)}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              ) : null}
              <span className="absolute top-4 inline-flex items-center gap-1.5 rounded-(--radius-pill) bg-accent px-3 py-1.5 text-xs tracking-[0.16em] uppercase text-canvas inset-s-4">
                {dict.advices.tipBadge}
              </span>
            </div>

            <div className="grid gap-3 p-5 sm:p-6">
              <h3 className={`m-0 leading-[1.2] ${isAr
                ? "text-xl font-bold font-(family-name:--font-ar) text-ink"
                : "text-2xl font-(--font-display) text-ink"}`}>
                {pickLang(advice.title, lang)}
              </h3>
              <p className="line-clamp-3 text-sm leading-[1.65] text-(--ink-2)">
                {pickLang(advice.description, lang)}
              </p>
              {advice.videoUrl && (
                <div className="mt-1 border-t border-(--hairline) pt-4">
                  <a
                    href={advice.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-accent underline-offset-4 hover:underline"
                  >
                    {dict.advices.readMore}
                  </a>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
