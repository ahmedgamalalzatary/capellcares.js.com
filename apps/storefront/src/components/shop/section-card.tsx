import Link from "next/link";
import { pickLang, formatPrice, type Language, type Offer, type Collection, type Advice } from "@capella/shared";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { CollectionIllustration } from "@/components/ui/collection-illustration";

type SectionCardProps =
  | { kind: "offer"; data: Offer; lang: Language; dict: any }
  | { kind: "collection"; data: Collection; lang: Language; dict: any }
  | { kind: "advice"; data: Advice; lang: Language; dict: any };

const CARD_CLASS =
  "group grid overflow-hidden rounded-lg border border-(--hairline) bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-warm hover:shadow-(--shadow-2)";
const IMAGE_WRAP_CLASS =
  "relative overflow-hidden bg-[radial-gradient(120%_120%_at_50%_0%,var(--warm-soft),var(--surface))]";
const BADGE_CLASS =
  "absolute top-4 inline-flex items-center gap-1.5 rounded-(--radius-pill) bg-accent px-3 py-1.5 text-xs tracking-[0.16em] uppercase text-canvas inset-s-4";

export function SectionCard(props: SectionCardProps) {
  const { lang, dict } = props;
  const isAr = lang === "ar";

  const titleClass = `m-0 leading-[1.2] ${isAr
    ? "text-xl font-bold font-(family-name:--font-ar) text-ink"
    : "text-2xl italic font-(--font-display) text-ink"}`;
  const priceClass = `leading-none text-accent ${isAr
    ? "text-2xl font-bold font-(family-name:--font-ar)"
    : "text-2xl italic font-(--font-display)"}`;

  // Per-kind derivations — the card knows which one it is rendering.
  let href: string | null = null;
  let title = "";
  let description = "";
  let badge = "";
  let image: React.ReactNode = null;
  let price: number | null = null;
  let originalTotal: number | null = null;
  let videoUrl: string | null = null;

  if (props.kind === "offer") {
    const offer = props.data;
    href = `/${lang}/offers/${offer.slug}`;
    title = pickLang(offer.name, lang);
    description = pickLang(offer.description, lang);
    badge = `★ ${dict.offers.badge}`;
    image = <OfferIllustration offer={offer} className="h-full w-full" />;
    price = offer.price;
    originalTotal = offer.originalTotal;
  } else if (props.kind === "collection") {
    const collection = props.data;
    href = `/${lang}/collections/${collection.slug}`;
    title = pickLang(collection.name, lang);
    description = pickLang(collection.description, lang);
    badge = `★ ${dict.collections.badge}`;
    image = <CollectionIllustration collection={collection} lang={lang} className="h-full w-full" />;
    price = collection.price;
    originalTotal = collection.originalTotal;
  } else {
    const advice = props.data;
    title = pickLang(advice.title, lang);
    description = pickLang(advice.description, lang);
    badge = dict.advices.tipBadge;
    videoUrl = advice.videoUrl ?? null;
    image = advice.imagePath ? (
      <img
        src={advice.imagePath}
        alt={title}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
    ) : null;
  }

  const savings = price != null && originalTotal != null ? originalTotal - price : 0;

  const body = (
    <>
      <div className={IMAGE_WRAP_CLASS}>
        {image}
        <span className={BADGE_CLASS}>{badge}</span>
      </div>

      <div className="grid gap-3 p-5 sm:p-6">
        <h3 className={titleClass}>{title}</h3>
        {description ? (
          <p className="line-clamp-3 text-sm leading-[1.65] text-(--ink-2)">{description}</p>
        ) : null}

        {price != null ? (
          <div className="mt-2 flex flex-wrap items-end gap-2.5 border-t border-(--hairline) pt-4">
            <span className={priceClass}>{formatPrice(price, lang)}</span>
            {savings > 0 ? (
              <>
                <span className="text-sm text-(--ink-3) line-through">
                  {formatPrice(originalTotal as number, lang)}
                </span>
                <span className="chip chip--accent">
                  {dict.common.save} {formatPrice(savings, lang)}
                </span>
              </>
            ) : null}
          </div>
        ) : null}

        {videoUrl ? (
          <div className="mt-1 border-t border-(--hairline) pt-4">
            <a
              href={videoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              {dict.advices.readMore}
            </a>
          </div>
        ) : null}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={CARD_CLASS}>
        {body}
      </Link>
    );
  }

  return <article className={CARD_CLASS}>{body}</article>;
}
