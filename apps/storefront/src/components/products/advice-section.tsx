import type { Advice, Language } from "@capella/shared";
import { SectionCard } from "@/components/shop/section-card";
import { ShopCardRow } from "@/components/shop/shop-card-row";
import { ShopHeading } from "@/components/shop/shop-tiles";

/** Falta advices. Always the shop page's single horizontally scrolling row, so the section reads identically wherever it appears (shop, product search results). */
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

  return (
    <section className="mb-14">
      <ShopHeading color="cyan">{dict.advices.title}</ShopHeading>

      <ShopCardRow lang={lang}>
        {advices.map((advice) => (
          <SectionCard key={advice.id} kind="advice" data={advice} lang={lang} dict={dict} />
        ))}
      </ShopCardRow>
    </section>
  );
}
