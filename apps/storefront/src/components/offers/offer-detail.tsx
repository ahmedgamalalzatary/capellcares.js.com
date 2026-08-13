"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { pickLang, formatPrice, type Category, type Language, type Offer, type Product, type RelatedItemCard, type ReviewPage } from "@capella/shared";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { ItemTagPill } from "@/components/ui/item-tags";
import { ShareButton } from "@/components/ui/share-button";
import { WishlistButton } from "@/components/ui/wishlist-button";
import { useCart } from "@/components/providers/cart-provider";
import { RelatedItems } from "@/components/products/related-items";
import { ReviewSummary } from "@/components/reviews/review-summary";
import { EntityMediaGallery } from "@/components/ui/entity-media-gallery";
import { useAddedFlash } from "@/hooks/use-added-flash";

interface ItemEntry {
  qty: number;
  variantId: number;
  product: Product;
  size: string;
  unitPrice: number;
  available: number;
}

interface Props {
  offer: Offer & { reviewData?: ReviewPage | null };
  category?: Category;
  items: ItemEntry[];
  lang: Language;
  dict: any;
  relatedItems?: RelatedItemCard[];
}

export function OfferDetail({ offer, category, items, lang, dict, relatedItems = [] }: Props) {
  const router = useRouter();
  const cart = useCart();
  const { added, flash: flashAdded } = useAddedFlash();
  const savings = offer.originalTotal - offer.price;
  const inStock = items.every((item) => item.available >= item.qty);

  const add = () => {
    cart.add({ type: "offer", offerId: offer.id, qty: 1 });
    flashAdded();
  };

  const buyNow = () => {
    cart.add({ type: "offer", offerId: offer.id, qty: 1 });
    router.push(`/${lang}/checkout`);
  };

  const isAr = lang === "ar";
  return (
    <>
      <div className="grid gap-6 py-2 sm:gap-8 sm:py-4 lg:grid-cols-[.7fr_1fr] lg:gap-15">
        <div className="grid gap-3 self-start sm:gap-4 lg:sticky lg:top-35">
          <EntityMediaGallery
            media={offer.media}
            imagePath={offer.imagePath}
            videoUrl={offer.youtubeUrl}
            label={pickLang(offer.name, lang)}
            testIdPrefix="offer"
            dotLabelTemplate={lang === "ar" ? "انتقل إلى الوسائط {index}" : "go to media {index}"}
            thumbnailLabelTemplate={lang === "ar" ? "اختر الوسائط {index}" : "select media {index}"}
            renderImage={(url) => <OfferIllustration offer={{ ...offer, imagePath: url }} className="h-full w-full object-contain rounded-lg" />}
            overlay={(
              <>
                <ItemTagPill
                  tag={{ kind: "offer", label: dict.offers.badge, star: true }}
                  className="absolute top-0 inset-s-0 z-10 rounded-ss-md"
                />
                <WishlistButton
                  entityType="offer"
                  entityId={offer.id}
                  lang={lang}
                  label={dict.offers.saveToWishlist ?? dict.common.addToWishlist}
                />
              </>
            )}
          />
        </div>

        <div className="grid gap-5 self-start sm:gap-7 lg:gap-8">
          <h1 className={isAr
            ? "m-0 text-[clamp(20px,3.4vw,32px)] font-bold font-(family-name:--font-ar) leading-[1.2] tracking-normal text-ink"
            : "m-0 text-[clamp(20px,3.4vw,32px)] font-(--font-display) leading-[1.05] tracking-[-0.01em] text-ink"}>
            {pickLang(offer.name, lang)}
          </h1>
          {offer.reviewData !== undefined && dict.reviews ? (
            <ReviewSummary entityType="offer" entityId={offer.id} reviewData={offer.reviewData} lang={lang} dict={dict} />
          ) : null}
          <p className="max-w-[60ch] text-base leading-[1.75] text-(--ink-2)">{pickLang(offer.description, lang)}</p>
          {category && (
            <div className="text-sm text-(--ink-3)">{dict.offers.categoryLabel}: {pickLang(category.name, lang)}</div>
          )}

          <div className="flex flex-wrap items-end gap-3 border-y border-(--hairline) py-4 sm:py-5">
            <span className={`leading-none text-accent ${isAr
              ? "text-3xl font-bold font-(family-name:--font-ar) sm:text-[36px]"
              : "text-3xl font-(--font-display) sm:text-[40px]"}`}>
              {formatPrice(offer.price, lang)}
            </span>
            {savings > 0 && (
              <>
                <span className="text-(--ink-3) line-through">{formatPrice(offer.originalTotal, lang)}</span>
                <span className="chip chip--accent">{dict.offers.save.replace("{amount}", formatPrice(savings, lang))}</span>
              </>
            )}
          </div>

          <div className="grid gap-3">
            <div className="eyebrow text-(--ink-3)!">{dict.offers.includes}</div>
            <div className="grid gap-2">
              {items.map((item) => (
                <Link
                  key={`${item.product.id}-${item.variantId}`}
                  href={`/${lang}/products/${item.product.slug}`}
                  className="grid grid-cols-[68px_1fr_auto] items-center gap-4 rounded-(--radius) border border-(--hairline) bg-surface p-3 transition-colors hover:border-warm hover:bg-(--warm-soft)"
                >
                  <div className="h-17 w-17 overflow-hidden rounded-md bg-(--warm-soft)">
                    <ProductIllustration product={item.product} className="h-full w-full" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">{pickLang(item.product.name, lang)}</div>
                    <div className="mt-0.5 text-sm text-(--ink-3)">
                      {item.size} · ×{item.qty}
                    </div>
                  </div>
                  <div className="ms-auto text-sm text-ink">
                    {formatPrice(item.unitPrice * item.qty, lang)}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <button className="btn btn--primary btn--lg btn--block capitalize" onClick={add} disabled={!inStock}>
              {added ? dict.offers.added : dict.offers.addBundleToCart}
            </button>
            <button className="btn btn--ghost btn--lg btn--block" onClick={buyNow} disabled={!inStock}>
              {dict.common.buyNow}
            </button>
            <ShareButton
              path={`/${lang}/offers/${offer.slug}`}
              title={pickLang(offer.name, lang)}
              dict={dict}
              className="btn--lg"
            />
          </div>

          {!inStock && (
            <p className="rounded-(--radius) bg-[color-mix(in_oklch,var(--error)_10%,transparent)] px-4 py-3 text-sm text-(--error)">
              {dict.offers.unavailable}
            </p>
          )}
        </div>
      </div>
      <RelatedItems items={relatedItems} lang={lang} dict={dict} title={dict.offers?.related} />
    </>
  );
}
