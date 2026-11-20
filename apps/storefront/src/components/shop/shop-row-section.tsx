import type { ReactNode } from "react";
import type { Language } from "@capella/shared";
import { ShopCardRow } from "@/components/shop/shop-card-row";
import { ShopHeading, ShopSectionHeading } from "@/components/shop/shop-tiles";

/** A shop page section of cards: its title with a "View all" link, then one sideways-scrolling row. Bestsellers, new, offers and every custom section use it, so they all look the same. */
export function ShopRowSection({
  title,
  color,
  viewAll,
  lang,
  children
}: {
  title: string;
  color?: Parameters<typeof ShopHeading>[0]["color"];
  viewAll: { href: string; label: string };
  lang: Language;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <ShopSectionHeading color={color} viewAll={viewAll}>
        {title}
      </ShopSectionHeading>
      <ShopCardRow lang={lang} fixedCards>{children}</ShopCardRow>
    </section>
  );
}
