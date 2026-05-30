import Link from "next/link";
import { formatPrice, pickLang, type Language, type RelatedItemCard } from "@capella/shared";

interface Props {
  items: RelatedItemCard[];
  lang: Language;
  title?: string;
}

function hrefFor(item: RelatedItemCard, lang: Language): string {
  const segment = item.type === "offer" ? "offers" : "products";
  return `/${lang}/${segment}/${item.slug}`;
}

export function RelatedItems({ items, lang, title }: Props) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-4 border-t border-(--hairline) py-6 sm:py-8" data-testid="related-items">
      {title && (
        <h2 className={lang === "ar"
          ? "m-0 text-[clamp(20px,2.4vw,28px)] font-bold font-(--font-ar) text-(--ink)"
          : "m-0 text-[clamp(22px,2.4vw,30px)] italic font-(--font-display) text-(--ink)"}>
          {title}
        </h2>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {items.map((item) => (
          <div className="related-item" data-testid="related-item" key={`${item.type}-${item.id}`}>
            <Link
              href={hrefFor(item, lang)}
              className="grid gap-2 rounded-(--radius) border border-(--hairline) bg-(--surface) p-3 transition-colors hover:border-(--warm)"
            >
              <span className="text-[14px] font-medium text-(--ink)">{pickLang(item.name, lang)}</span>
              <span className="text-[13px] text-(--accent)">{formatPrice(item.price, lang)}</span>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
