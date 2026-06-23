import type { Advice, Language } from "@capella/shared";
import { SectionCard } from "@/components/shop/section-card";
import { ShopCardRow } from "@/components/shop/shop-card-row";

export function AdviceSection({
  advices,
  lang,
  dict,
  scrollRow = false
}: {
  advices: Advice[];
  lang: Language;
  dict: any;
  /** Shop page only: render as a single horizontally scrolling row instead of a grid. */
  scrollRow?: boolean;
}) {
  if (advices.length === 0) return null;
  const isAr = lang === "ar";

  const cards = advices.map((advice) => (
    <SectionCard key={advice.id} kind="advice" data={advice} lang={lang} dict={dict} />
  ));

  return (
    <section className="mt-12 mb-12">
      <header className="mb-10 grid gap-2 pt-8 ">
        <h2 className={isAr
          ? "m-0 text-[clamp(26px,2.6vw,38px)] font-bold font-(family-name:--font-ar) leading-tight text-ink "
          : "m-0 text-[clamp(28px,2.8vw,40px)] leading-[1.1] tracking-[-0.005em] text-ink font-bold uppercase"}>
          {dict.advices.title}
        </h2>
        <p className="max-w-[58ch] text-base leading-[1.7] text-(--ink-2)">{dict.advices.description}</p>
      </header>

      {scrollRow ? (
        <ShopCardRow lang={lang}>{cards}</ShopCardRow>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7">{cards}</div>
      )}
    </section>
  );
}
