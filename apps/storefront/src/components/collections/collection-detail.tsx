"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice, pickLang, type Category, type Collection, type Language, type Product, type RelatedItemCard, type ReviewPage } from "@capella/shared";
import { CollectionIllustration } from "@/components/ui/collection-illustration";
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

export function CollectionDetail({
  collection,
  category,
  items,
  lang,
  dict,
  relatedItems = []
}: {
  collection: Collection & { reviewData?: ReviewPage | null };
  category?: Category;
  items: ItemEntry[];
  lang: Language;
  dict: any;
  relatedItems?: RelatedItemCard[];
}) {
  const router = useRouter();
  const cart = useCart();
  const { added, flash: flashAdded } = useAddedFlash();
  const savings = collection.originalTotal - collection.price;
  const inStock = items.every((item) => item.available >= item.qty);
  const isAr = lang === "ar";

  const add = () => {
    cart.add({ type: "collection", collectionId: collection.id, qty: 1 });
    flashAdded();
  };

  const buyNow = () => {
    cart.add({ type: "collection", collectionId: collection.id, qty: 1 });
    router.push(`/${lang}/checkout`);
  };

  return (
    <>
      <div className="grid gap-6 py-2 sm:gap-8 sm:py-4 lg:grid-cols-[.7fr_1fr] lg:gap-15">
        <div className="grid gap-3 self-start sm:gap-4 lg:sticky lg:top-35">
          <EntityMediaGallery
            media={collection.media}
            imagePath={collection.imagePath}
            videoUrl={collection.youtubeUrl}
            label={pickLang(collection.name, lang)}
            testIdPrefix="collection"
            dotLabelTemplate={lang === "ar" ? "انتقل إلى الوسائط {index}" : "go to media {index}"}
            thumbnailLabelTemplate={lang === "ar" ? "اختر الوسائط {index}" : "select media {index}"}
            renderImage={(url) => <CollectionIllustration collection={{ ...collection, imagePath: url }} lang={lang} className="h-full w-full object-contain rounded-lg" />}
            overlay={(
              <>
                <ItemTagPill
                  tag={{ kind: "collection", label: dict.collections.badge, star: true }}
                  className="absolute top-0 inset-s-0 z-10 rounded-ss-md"
                />
                <WishlistButton
                  entityType="collection"
                  entityId={collection.id}
                  lang={lang}
                  label={dict.collections.saveToWishlist ?? dict.common.addToWishlist}
                />
              </>
            )}
          />
        </div>

        <div className="grid gap-5 self-start sm:gap-7 lg:gap-8">
          <h1 className={isAr
            ? "m-0 text-[clamp(20px,3.4vw,32px)] font-bold font-(family-name:--font-ar) leading-[1.2] tracking-normal text-ink"
            : "m-0 text-[clamp(20px,3.4vw,32px)] font-(--font-display) leading-[1.05] tracking-[-0.01em] text-ink"}>
            {pickLang(collection.name, lang)}
          </h1>
          {collection.reviewData !== undefined && dict.reviews ? (
            <ReviewSummary entityType="collection" entityId={collection.id} reviewData={collection.reviewData} lang={lang} dict={dict} />
          ) : null}
          <p className="max-w-[60ch] text-base leading-[1.75] text-(--ink-2)">{pickLang(collection.description, lang)}</p>
          {category && (
            <div className="text-sm text-(--ink-3)">{dict.collections.categoryLabel}: {pickLang(category.name, lang)}</div>
          )}

          <div className="flex flex-wrap items-end gap-3 border-y border-(--hairline) py-4 sm:py-5">
            <span className={`leading-none text-accent ${isAr
              ? "text-3xl font-bold font-(family-name:--font-ar) sm:text-[36px]"
              : "text-3xl font-(--font-display) sm:text-[40px]"}`}>
              {formatPrice(collection.price, lang)}
            </span>
            {savings > 0 && (
              <>
                <span className="text-(--ink-3) line-through">{formatPrice(collection.originalTotal, lang)}</span>
                <span className="chip chip--accent">{dict.common.save} {formatPrice(savings, lang)}</span>
              </>
            )}
          </div>

          <div className="grid gap-3">
            <div className="eyebrow text-(--ink-3)!">{dict.collections.itemsLabel}</div>
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
                    <div className="mt-0.5 text-sm text-(--ink-3)">{item.size} · ×{item.qty}</div>
                  </div>
                  <div className="ms-auto text-sm text-ink">{formatPrice(item.unitPrice * item.qty, lang)}</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <button className="btn btn--primary btn--lg btn--block capitalize" onClick={add} disabled={!inStock}>
              {added ? dict.collections.added : dict.collections.addCollectionToCart}
            </button>
            <button className="btn btn--ghost btn--lg btn--block" onClick={buyNow} disabled={!inStock}>
              {dict.common.buyNow}
            </button>
            <ShareButton
              path={`/${lang}/collections/${collection.slug}`}
              title={pickLang(collection.name, lang)}
              dict={dict}
              className="btn--lg"
            />
          </div>

          {!inStock && (
            <p className="rounded-(--radius) bg-[color-mix(in_oklch,var(--error)_10%,transparent)] px-4 py-3 text-sm text-(--error)">
              {dict.collections.unavailable}
            </p>
          )}
        </div>
      </div>
      <RelatedItems items={relatedItems} lang={lang} dict={dict} title={dict.collections.related} />
    </>
  );
}
