"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { pickLang, formatPrice, getEffectiveVariantPrice, type Language, type Product, type ReviewPage, type Offer, type RelatedItemCard } from "@capella/shared";
import { RelatedItems } from "@/components/products/related-items";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { ItemTags, getProductTags, type ItemTag } from "@/components/ui/item-tags";
import { Icon } from "@/components/ui/icons";
import { ShareButton } from "@/components/ui/share-button";
import { WishlistButton } from "@/components/ui/wishlist-button";
import { useCart } from "@/components/providers/cart-provider";
import { ReviewSummary } from "@/components/reviews/review-summary";
import { EntityMediaGallery } from "@/components/ui/entity-media-gallery";

type Tab = "description" | "ingredients" | "howToUse" | "warnings";

interface Props {
  product: Product & { reviewData?: ReviewPage | null };
  offers: Offer[];
  lang: Language;
  dict: any;
  categoryName?: string;
  relatedItems?: RelatedItemCard[];
}

export function ProductDetail({ product, offers, lang, dict, categoryName, relatedItems = [] }: Props) {
  const router = useRouter();
  const cart = useCart();
  const badgeTags: ItemTag[] = [
    ...getProductTags(product, dict),
    ...offers.map((offer): ItemTag => ({
      kind: "offer",
      label: pickLang(offer.name, lang),
      href: `/${lang}/offers/${offer.slug}`,
      star: true,
    })),
  ];

  const firstInStockVariant = product.variants.find((variant) => variant.stock > 0);
  const [variantId, setVariantId] = useState<number | null>(firstInStockVariant?.id ?? product.variants[0]?.id ?? null);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<Tab>("description");
  const [added, setAdded] = useState(false);
  const variant = useMemo(
    () => product.variants.find((item) => item.id === variantId) ?? null,
    [variantId, product.variants]
  );
  const effectiveVariantPrice = variant ? getEffectiveVariantPrice(variant) : null;
  const isOutOfStock = variant == null || variant.stock === 0;

  const addToCart = () => {
    if (!variant) return;
    cart.add({ type: "product", productId: product.id, variantId: variant.id, qty });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const buyNow = () => {
    if (!variant) return;
    cart.add({ type: "product", productId: product.id, variantId: variant.id, qty });
    router.push(`/${lang}/checkout`);
  };

  const tabs: { key: Tab; label: string; content: string }[] = [
    { key: "description", label: dict.product.description, content: pickLang(product.description, lang) },
    { key: "ingredients", label: dict.product.ingredients, content: pickLang(product.ingredients, lang) },
    { key: "howToUse", label: dict.product.howToUse, content: pickLang(product.howToUse, lang) },
    { key: "warnings", label: dict.product.warnings, content: pickLang(product.warnings, lang) }
  ];
  return (
    <>
      <div className="grid gap-6 py-2 sm:gap-8 sm:py-4 lg:grid-cols-[1.1fr_1fr] lg:gap-15">
        <div className="grid gap-3 self-start sm:gap-4 lg:sticky lg:top-35">
          <EntityMediaGallery
            media={product.media}
            imagePath={product.imagePath}
            label={pickLang(product.name, lang)}
            testIdPrefix="product"
            dotLabelTemplate={dict.product?.mediaDotLabel ?? (lang === "ar" ? "انتقل إلى الوسائط {index}" : "go to media {index}")}
            thumbnailLabelTemplate={lang === "ar" ? "اختر الوسائط {index}" : "select media {index}"}
            renderImage={(url) => <ProductIllustration product={{ ...product, imagePath: url }} />}
            overlay={(
              <WishlistButton
                entityType="product"
                entityId={product.id}
                lang={lang}
                label={dict.common.addToWishlist}
              />
            )}
          />
        </div>

        <div className="grid gap-5 self-start sm:gap-7 lg:gap-8">
          <div className="grid gap-3">
            <h1 className={lang === "ar"
              ? "m-0 text-[clamp(30px,3.4vw,46px)] font-bold font-(family-name:--font-ar) leading-[1.2] tracking-normal text-ink"
              : "m-0 text-[clamp(32px,3.4vw,48px)] font-(--font-display) leading-[1.05] tracking-[-0.01em] text-ink"}>
              {pickLang(product.name, lang)}
            </h1>
            {categoryName ? (
              <p className={lang === "ar" ? "font-(family-name:--font-ar)" : "tracking-[0.08em] uppercase"}>
                {categoryName}
              </p>
            ) : null}
            <ItemTags tags={badgeTags} variant="badge" />
            {product.reviewData !== undefined && dict.reviews ? (
              <ReviewSummary entityType="product" entityId={product.id} reviewData={product.reviewData} lang={lang} dict={dict} />
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-3 border-y border-(--hairline) py-4 sm:py-5">
            <span className={lang === "ar"
              ? "text-3xl font-bold font-(family-name:--font-ar) leading-none text-accent sm:text-[36px]"
              : "text-3xl font-(--font-display) leading-none text-accent sm:text-[40px]"}>
              {variant && effectiveVariantPrice != null && !isOutOfStock ? formatPrice(effectiveVariantPrice, lang) : dict.common.outOfStock}
            </span>
            {variant && effectiveVariantPrice != null && !isOutOfStock && effectiveVariantPrice !== variant.price ? (
              <span className="text-base text-(--ink-3) line-through">{formatPrice(variant.price, lang)}</span>
            ) : null}
            {isOutOfStock ? (
              <span className="chip text-(--error)! font-semibold">{dict.common.outOfStock}</span>
            ) : variant.stock <= 5 ? (
              <span className="chip chip--gold">{dict.common.lowStock.replace("{n}", String(variant.stock))}</span>
            ) : (
              <span className="chip text-(--success)! font-semibold">{dict.common.inStock}</span>
            )}
          </div>

          <div className="grid gap-2">
            <div className="eyebrow text-(--ink-3)! opacity-100!">
              {dict.product.selectSize}
            </div>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((item) => (
                <button
                  key={item.id}
                  className={[
                    "grid min-w-28 gap-0.5 rounded-md px-4 py-3 text-start transition-colors",
                    item.stock > 0 ? "hover:border-warm hover:bg-(--warm-soft)" : "cursor-not-allowed opacity-45 line-through",
                    variantId === item.id ? "border-accent bg-canvas text-ink" : "border border-(--hairline) bg-surface text-(--ink-2)"
                  ].join(" ")}
                  data-active={variantId === item.id}
                  data-out={item.stock === 0 ? "true" : undefined}
                  onClick={() => item.stock > 0 && setVariantId(item.id)}
                  disabled={item.stock === 0}
                >
                  <span className="text-sm font-medium">{item.size}</span>
                  <span className="text-xs opacity-80">{formatPrice(getEffectiveVariantPrice(item), lang)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="eyebrow text-(--ink-3)! opacity-100!">
              {dict.common.quantity}
            </div>
            <div className="flex w-full items-center justify-between gap-1 rounded-(--radius-pill) border border-(--hairline) bg-surface p-1">
              <button
                className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-(--ink-2) transition-colors hover:bg-(--warm-soft) hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                onClick={() => setQty((value) => Math.max(1, value - 1))}
                aria-label="−"
                disabled={qty <= 1}
              >
                <Icon.Minus />
              </button>
              <span className="min-w-10 text-center text-base font-semibold tabular-nums text-ink">{qty}</span>
              <button
                className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-(--ink-2) transition-colors hover:bg-(--warm-soft) hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                onClick={() => setQty((value) => Math.min(variant?.stock || 1, value + 1))}
                aria-label="+"
                disabled={variant == null || qty >= (variant?.stock ?? 0)}
              >
                <Icon.Plus />
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-[1fr_1fr_auto]">
            <button className="btn btn--primary btn--block" onClick={addToCart} disabled={isOutOfStock}>
              {added ? dict.common.added : dict.common.addToCart}
            </button>
            <button className="btn btn--ghost btn--block" onClick={buyNow} disabled={isOutOfStock}>
              {dict.common.buyNow}
            </button>
            <ShareButton
              path={`/${lang}/products/${product.slug}`}
              title={pickLang(product.name, lang)}
              dict={dict}
            />
          </div>

          <div className="-mx-4 overflow-x-auto border-b border-(--hairline) px-4 scrollbar-none sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-1">
              {tabs.map((item) => {
                const active = tab === item.key;
                return (
                  <button
                    key={item.key}
                    className={[
                      "relative mx-0 me-2 shrink-0 whitespace-nowrap border-0 bg-transparent px-1.5 py-3.5 text-sm transition-colors",
                      active ? "text-ink font-semibold" : "text-(--ink-3) hover:text-(--ink-2)"
                    ].join(" ")}
                    data-active={active}
                    onClick={() => setTab(item.key)}
                  >
                    {item.label}
                    {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-base leading-[1.85] text-(--ink-2)">
            {tabs.find((item) => item.key === tab)?.content}
          </div>
        </div>
      </div>
      <RelatedItems items={relatedItems} lang={lang} dict={dict} title={dict.product?.related} />
    </>
  );
}
