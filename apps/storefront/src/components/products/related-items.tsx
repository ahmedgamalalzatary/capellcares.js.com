import Link from "next/link";
import { formatPrice, pickLang, type Language, type RelatedItemCard } from "@capella/shared";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { CollectionIllustration } from "@/components/ui/collection-illustration";

interface Props {
  items: RelatedItemCard[];
  lang: Language;
  title?: string;
}

function hrefFor(item: RelatedItemCard, lang: Language): string {
  const segment = item.type === "offer" ? "offers" : item.type === "collection" ? "collections" : "products";
  return `/${lang}/${segment}/${item.slug}`;
}

function itemTypeLabel(item: RelatedItemCard, lang: Language): string {
  if (item.type === "offer") {
    return lang === "ar" ? "عرض" : "Offer";
  }
  if (item.type === "collection") {
    return lang === "ar" ? "مجموعة" : "Collection";
  }
  return lang === "ar" ? "منتج" : "Product";
}

export function RelatedItems({ items, lang, title }: Props) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-4 border-t border-(--hairline) py-6 sm:py-8" data-testid="related-items">
      {title && (
        <h2 className={lang === "ar"
          ? "m-0 text-[clamp(20px,2.4vw,28px)] font-bold font-(family-name:--font-ar) text-ink"
          : "m-0 text-[clamp(22px,2.4vw,30px)] italic font-(--font-display) text-ink"}>
          {title}
        </h2>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {items.map((item) => (
          <div className="related-item" data-testid="related-item" key={`${item.type}-${item.id}`}>
            <Link
              href={hrefFor(item, lang)}
              className="group grid overflow-hidden rounded-lg border border-(--hairline) bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-warm hover:shadow-(--shadow-2)"
            >
              <div className="relative aspect-4/5 overflow-hidden bg-[radial-gradient(120%_120%_at_50%_0%,var(--surface),var(--warm-soft))]">
                {item.type === "offer" ? (
                  <OfferIllustration
                    offer={{ slug: item.slug, name: item.name, imagePath: item.imagePath ?? "" }}
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : item.type === "collection" ? (
                  <CollectionIllustration
                    collection={{ slug: item.slug, name: item.name, imagePath: item.imagePath ?? "" }}
                    lang={lang}
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <ProductIllustration
                    product={{ slug: item.slug, name: item.name, imagePath: item.imagePath ?? "" }}
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                )}
                <span className="absolute top-3 inset-s-3 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-(--ink-2) shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                  {itemTypeLabel(item, lang)}
                </span>
              </div>
              <div className="grid gap-2 p-4 sm:p-5">
                <h3 className={lang === "ar"
                  ? "m-0 text-base font-bold font-(family-name:--font-ar) leading-tight text-ink"
                  : "m-0 text-[17px] italic font-(--font-display) leading-[1.15] text-ink"}>
                  {pickLang(item.name, lang)}
                </h3>
                <div className="mt-1 flex items-end gap-2 border-t border-(--hairline) pt-3">
                  <span className={lang === "ar"
                    ? "text-lg font-bold font-(family-name:--font-ar) leading-none text-accent"
                    : "text-xl italic font-(--font-display) leading-none text-accent"}>
                    {formatPrice(item.price, lang)}
                  </span>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
