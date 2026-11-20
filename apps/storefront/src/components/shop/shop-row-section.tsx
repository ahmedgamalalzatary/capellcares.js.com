import type { ReactNode } from "react";
import Link from "next/link";
import type { Language } from "@capella/shared";
import { ShopCardRow } from "@/components/shop/shop-card-row";

/** A shop page section of cards: its title with a "View all" link, then one sideways-scrolling row. Offers, collections, bestsellers, new and every category section use it, so they all look the same. */
export function ShopRowSection({
  id,
  title,
  viewAll,
  mutedLink = false,
  lang,
  children
}: {
  /** Unique on the page: the section is named by its title through this id. */
  id: string;
  title: string;
  viewAll: { href: string; label: string };
  /** The bestsellers link has always been the quieter ink colour. */
  mutedLink?: boolean;
  lang: Language;
  children: ReactNode;
}) {
  const isAr = lang === "ar";
  return (
    <section aria-labelledby={id} className="mb-8">
      <header className="mb-6 flex items-end justify-between">
        <div className="grid gap-1.5 font-bold uppercase">
          <h2 id={id} className={isAr
            ? "m-0 text-[clamp(22px,2.2vw,32px)] font-bold font-(family-name:--font-ar) leading-tight text-ink"
            : "m-0 text-[clamp(24px,2.4vw,36px)] font-(--font-display) leading-[1.1] tracking-[-0.005em] text-ink"}>
            {title}
          </h2>
        </div>
        <Link
          href={viewAll.href}
          className={`shrink-0 text-sm underline-offset-4 hover:underline ${mutedLink ? "text-(--ink-2) hover:text-ink" : "text-accent"} ${isAr ? "" : "uppercase tracking-[0.08em]"}`}
        >
          {viewAll.label}
        </Link>
      </header>
      <ShopCardRow lang={lang}>{children}</ShopCardRow>
    </section>
  );
}
