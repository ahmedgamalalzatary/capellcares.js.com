"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { pickLang, formatPrice, getEffectiveVariantPrice, productColorName, type Language, type Product, type ReviewPage, type Offer, type RelatedItemCard } from "@capella/shared";
import { RelatedItems } from "@/components/products/related-items";
import { ProductAttributeLinks } from "@/components/products/product-attribute-links";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { ItemTagPill, ItemTags, getProductTags, type ItemTag } from "@/components/ui/item-tags";
import { Icon } from "@/components/ui/icons";
import { ShareButton } from "@/components/ui/share-button";
import { WishlistButton } from "@/components/ui/wishlist-button";
import { useCart } from "@/components/providers/cart-provider";
import { ReviewSummary } from "@/components/reviews/review-summary";
import { EntityMediaGallery } from "@/components/ui/entity-media-gallery";
import { useAddedFlash } from "@/hooks/use-added-flash";

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
  // New/bestseller float over the media as a single lead tag, exactly like the cards do; only the linked offers remain as inline badges beside the title.
  const leadTag = getProductTags(product, dict)[0];
  const badgeTags: ItemTag[] = offers.map((offer): ItemTag => ({
    kind: "offer",
    label: pickLang(offer.name, lang),
    href: `/${lang}/offers/${offer.slug}`,
    star: true,
  }));

  const variants = product.variants;
  // Only colours and sizes that some variant uses are offered; a product without either shows no choice at all.
  const colors = useMemo(
    () => (product.colors ?? []).filter((color) => variants.some((item) => item.colorId === color.id)),
    [product.colors, variants]
  );
  const sizes = useMemo(
    () => [...new Set(variants.map((item) => item.size.trim()).filter(Boolean))],
    [variants]
  );
  const startVariant = variants.find((item) => item.stock > 0) ?? variants[0];
  const [colorId, setColorId] = useState<number | null>(startVariant?.colorId ?? null);
  const [size, setSize] = useState<string>(startVariant?.size.trim() ?? "");
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<Tab>("description");
  const { added, flash: flashAdded } = useAddedFlash();
  const variantFor = (sizeLabel: string, color: number | null) =>
    variants.find((item) => item.size.trim() === sizeLabel && (item.colorId ?? null) === color) ?? null;
  const variant = variantFor(size, colorId);
  const color = colors.find((item) => item.id === colorId) ?? null;
  // The chosen colour's gallery; a colour without pictures of its own shows the general ones.
  const galleryMedia = color && color.media.length > 0 ? color.media : product.media;

  const chooseColor = (id: number) => {
    setColorId(id);
    setQty(1);
    if (variantFor(size, id)?.stock) return;
    const fallback = variants.find((item) => item.colorId === id && item.stock > 0)
      ?? variants.find((item) => item.colorId === id);
    if (fallback) setSize(fallback.size.trim());
  };

  const chooseSize = (label: string) => {
    setSize(label);
    setQty(1);
  };
  const effectiveVariantPrice = variant ? getEffectiveVariantPrice(variant) : null;
  const isOutOfStock = variant == null || variant.stock === 0;

  const addToCart = () => {
    if (!variant) return;
    cart.add({ type: "product", productId: product.id, variantId: variant.id, qty });
    flashAdded();
  };

  const buyNow = () => {
    if (!variant) return;
    cart.add({ type: "product", productId: product.id, variantId: variant.id, qty });
    router.push(`/${lang}/checkout`);
  };

  const allTabs: { key: Tab; label: string; content: string }[] = [
    { key: "description", label: dict.product.description, content: pickLang(product.description, lang) },
    { key: "ingredients", label: dict.product.ingredients, content: pickLang(product.ingredients, lang) },
    { key: "howToUse", label: dict.product.howToUse, content: pickLang(product.howToUse, lang) },
    { key: "warnings", label: dict.product.warnings, content: pickLang(product.warnings, lang) }
  ];
  const tabs = allTabs.filter((item) => item.content?.trim());
  const activeTab = tabs.find((item) => item.key === tab) ?? tabs[0];
  return (
    <>
      <div className="grid gap-6 py-2 sm:gap-8 sm:py-4 lg:grid-cols-[.7fr_1fr] lg:gap-15">
        <div className="grid gap-3 self-start sm:gap-4 lg:sticky lg:top-35">
          <EntityMediaGallery
            key={colorId ?? 0}
            media={galleryMedia}
            lang={lang}
            imagePath={product.imagePath}
            videoUrl={product.youtubeUrl}
            label={pickLang(product.name, lang)}
            testIdPrefix="product"
            dotLabelTemplate={dict.product?.mediaDotLabel ?? (lang === "ar" ? "انتقل إلى الوسائط {index}" : "go to media {index}")}
            thumbnailLabelTemplate={lang === "ar" ? "اختر الوسائط {index}" : "select media {index}"}
            renderImage={(url) => <ProductIllustration product={{ ...product, imagePath: url }} lang={lang} />}
            overlay={(
              <>
                {leadTag ? (
                  <ItemTagPill tag={leadTag} className="absolute top-2.5 inset-s-2.5 z-10 rounded-full" />
                ) : null}
                <WishlistButton
                  entityType="product"
                  entityId={product.id}
                  lang={lang}
                  label={dict.common.addToWishlist}
                />
              </>
            )}
          />
        </div>

        <div className="grid gap-5 self-start sm:gap-7 lg:gap-8">
          <div className="grid gap-3">
            <h1 className={"m-0 text-[clamp(26px,3.4vw,40px)] font-extrabold leading-[1.15] text-ink"}>
              {pickLang(product.name, lang)}
            </h1>
            {categoryName ? (
              <p className="m-0 text-(--ink-3)">
                {categoryName}
              </p>
            ) : null}
            <ItemTags tags={badgeTags} variant="badge" />
            <ProductAttributeLinks product={product} lang={lang} dict={dict} />
            {product.reviewData !== undefined && dict.reviews ? (
              <ReviewSummary entityType="product" entityId={product.id} reviewData={product.reviewData} lang={lang} dict={dict} />
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-3 border-y border-(--hairline) py-4 sm:py-5">
            <span className={"text-3xl font-extrabold leading-none text-(--magenta-deep) sm:text-[38px]"}>
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

          {colors.length > 0 ? (
            <div className="grid gap-2">
              <div id="product-color-label" className="font-bold text-(--ink-2)">
                {dict.product.selectColor}
                {color && productColorName(color, lang) ? (
                  <span className="ms-2 font-semibold text-(--ink-3)">{productColorName(color, lang)}</span>
                ) : null}
              </div>
              <div role="radiogroup" aria-labelledby="product-color-label" className="flex flex-wrap gap-2.5">
                {colors.map((item) => {
                  const name = productColorName(item, lang);
                  const active = colorId === item.id;
                  const soldOut = !variants.some((entry) => entry.colorId === item.id && entry.stock > 0);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={name || item.hex || undefined}
                      title={name || undefined}
                      onClick={() => chooseColor(item.id)}
                      className={[
                        "relative grid min-h-11 min-w-11 place-items-center rounded-full border-2 p-1 transition-colors",
                        active ? "border-(--violet)" : "border-(--hairline) hover:border-(--ink-3)",
                        soldOut ? "opacity-45" : ""
                      ].join(" ")}
                    >
                      {item.hex ? (
                        <span aria-hidden className="block size-8 rounded-full shadow-[inset_0_0_0_1px_var(--hairline)]" style={{ backgroundColor: item.hex }} />
                      ) : (
                        <span className="px-2.5 text-sm font-semibold text-ink">{name}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {sizes.length > 0 ? (
            <div className="grid gap-2">
              <div id="product-size-label" className="font-bold text-(--ink-2)">
                {dict.product.selectSize}
              </div>
              <div role="radiogroup" aria-labelledby="product-size-label" className="flex flex-wrap gap-2">
                {sizes.map((label) => {
                  const item = variantFor(label, colorId);
                  const available = Boolean(item && item.stock > 0);
                  const active = size === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={[
                        "grid min-w-28 gap-0.5 rounded-2xl border-2 px-4 py-3 text-start transition-colors",
                        available ? "hover:bg-(--warm-soft)" : "cursor-not-allowed opacity-45 line-through",
                        active ? "border-(--violet) bg-(--warm-soft) text-ink" : "border-(--hairline) bg-surface text-(--ink-2)"
                      ].join(" ")}
                      data-active={active}
                      data-out={available ? undefined : "true"}
                      onClick={() => available && chooseSize(label)}
                      disabled={!available}
                    >
                      <span className="text-sm font-medium">{label}</span>
                      {item ? <span className="text-xs opacity-80">{formatPrice(getEffectiveVariantPrice(item), lang)}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            <div className="font-bold text-(--ink-2)">
              {dict.common.quantity}
            </div>
            <div className="flex w-full items-center justify-between gap-1 rounded-(--radius-pill) bg-(--warm-soft) p-1">
              <button
                className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-(--ink-2) transition-colors hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                onClick={() => setQty((value) => Math.max(1, value - 1))}
                aria-label="−"
                disabled={qty <= 1}
              >
                <Icon.Minus />
              </button>
              <span className="min-w-10 text-center text-base font-semibold tabular-nums text-ink">{qty}</span>
              <button
                className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-(--ink-2) transition-colors hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-30"
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

          {activeTab ? (
            <>
              <div className="-mx-4 overflow-x-auto border-b border-(--hairline) px-4 scrollbar-none sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
                <div className="flex min-w-max gap-1">
                  {tabs.map((item) => {
                    const active = activeTab.key === item.key;
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
                {activeTab.content}
              </div>
            </>
          ) : null}
        </div>
      </div>
      <RelatedItems items={relatedItems} lang={lang} dict={dict} title={dict.product?.related} />
    </>
  );
}
