import type { Advice, Language } from "@capella/shared";
import { SectionCard } from "@/components/shop/section-card";
import { ShopCardRow } from "@/components/shop/shop-card-row";

/**
 * Capella Tips. Always the shop page's single horizontally scrolling row, so the
 * section reads identically wherever it appears (shop, product search results).
 */
export function AdviceSection({
  advices,
  lang,
  dict
}: {
  advices: Advice[];
  lang: Language;
  dict: any;
}) {
  if (advices.length === 0) return null;
  const isAr = lang === "ar";

  return (
    <section className="mt-4 mb-4">
      <header className="mb-8 grid gap-2">
        <h2 className={isAr
          ? "m-0 text-[clamp(26px,2.6vw,38px)] font-bold font-(family-name:--font-ar) leading-tight text-ink "
          : "m-0 text-[clamp(28px,2.8vw,40px)] leading-[1.1] tracking-[-0.005em] text-ink font-bold uppercase"}>
          {dict.advices.title}
        </h2>
      </header>

      {/* White arrows: every advice card is dark video artwork. */}
      <ShopCardRow lang={lang} arrowTone="canvas">
        {advices.map((advice) => (
          <SectionCard key={advice.id} kind="advice" data={advice} lang={lang} dict={dict} />
        ))}
      </ShopCardRow>
    </section>
  );
}
