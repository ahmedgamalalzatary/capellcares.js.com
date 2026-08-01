"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { pickLang, formatPrice, getEffectiveVariantPrice, type Language, type Product, type Offer, type RelatedItemCard } from "@capella/shared";
import { RelatedItems } from "@/components/products/related-items";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { ItemTags, getProductTags, type ItemTag } from "@/components/ui/item-tags";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { useAuth } from "@/components/providers/auth-provider";

type Tab = "description" | "ingredients" | "howToUse" | "warnings";

interface Props {
  product: Product;
  offers: Offer[];
  lang: Language;
  dict: any;
  categoryName?: string;
  relatedItems?: RelatedItemCard[];
}

export function ProductDetail({ product, offers, lang, dict, categoryName, relatedItems = [] }: Props) {
  const router = useRouter();
  const cart = useCart();
  const wishlist = useWishlist();
  const auth = useAuth();
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
  const [linkCopied, setLinkCopied] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; pointerType: string } | null>(null);
  const activeMediaPointerTargetRef = useRef<HTMLElement | null>(null);
  const activeMediaIndexRef = useRef(0);
  const media = useMemo(
    () => (product.media?.length ? product.media : product.imagePath ? [{ type: "image" as const, url: product.imagePath }] : []),
    [product.media, product.imagePath]
  );
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const activeMedia = media[activeMediaIndex] ?? media[0] ?? null;
  activeMediaIndexRef.current = activeMediaIndex;

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

  const onShare = async () => {
    const url = `${window.location.origin}/${lang}/products/${product.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: pickLang(product.name, lang), url });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1600);
    } catch {
      // clipboard write failed; nothing more we can do
    }
  };

  const onWish = () => {
    if (!auth.user) {
      router.push(`/${lang}/wishlist`);
      return;
    }
    wishlist.toggle("product", product.id);
  };

  const tabs: { key: Tab; label: string; content: string }[] = [
    { key: "description", label: dict.product.description, content: pickLang(product.description, lang) },
    { key: "ingredients", label: dict.product.ingredients, content: pickLang(product.ingredients, lang) },
    { key: "howToUse", label: dict.product.howToUse, content: pickLang(product.howToUse, lang) },
    { key: "warnings", label: dict.product.warnings, content: pickLang(product.warnings, lang) }
  ];
  const mediaDotLabelTemplate = dict.product?.mediaDotLabel ?? (lang === "ar" ? "انتقل إلى الوسائط {index}" : "go to media {index}");

  const clearMediaPointer = (pointerId: number) => {
    dragStartRef.current = null;
    const target = activeMediaPointerTargetRef.current;
    activeMediaPointerTargetRef.current = null;
    if (target && "hasPointerCapture" in target && target.hasPointerCapture(pointerId) && "releasePointerCapture" in target) {
      target.releasePointerCapture(pointerId);
    }
  };

  const completeMediaSwipe = ({ clientX, clientY, isPrimary, pointerId }: Pick<globalThis.PointerEvent, "clientX" | "clientY" | "isPrimary" | "pointerId">) => {
    const dragStart = dragStartRef.current;
    clearMediaPointer(pointerId);
    if (media.length <= 1 || !isPrimary || !dragStart) return;
    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;
    if (Math.abs(deltaX) < 36 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    const direction = deltaX < 0 ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(media.length - 1, activeMediaIndexRef.current + direction));
    if (nextIndex === activeMediaIndexRef.current) return;
    setActiveMediaIndex(nextIndex);
  };

  useEffect(() => {
    const handlePointerUp = (event: globalThis.PointerEvent) => {
      if (!dragStartRef.current) return;
      completeMediaSwipe(event);
    };
    const handlePointerCancel = (event: globalThis.PointerEvent) => {
      if (!dragStartRef.current) return;
      clearMediaPointer(event.pointerId);
    };

    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [media.length]);

  const onMediaPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (media.length <= 1 || !event.isPrimary) return;
    dragStartRef.current = { x: event.clientX, y: event.clientY, pointerType: event.pointerType };
    activeMediaPointerTargetRef.current = event.currentTarget;
    if ("setPointerCapture" in event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onMediaPointerUp = (event: PointerEvent<HTMLElement>) => {
    completeMediaSwipe(event.nativeEvent);
  };

  return (
    <>
      <div className="grid gap-6 py-2 sm:gap-8 sm:py-4 lg:grid-cols-[1.1fr_1fr] lg:gap-15">
        <div className="grid gap-3 self-start sm:gap-4 lg:sticky lg:top-35">
          <div
            className="relative grid place-items-center lg:place-items-start overflow-hidden rounded-md sm:rounded-md"
            data-testid="product-media-main"
            onPointerDown={onMediaPointerDown}
            onPointerUp={onMediaPointerUp}
            onPointerCancel={(event) => clearMediaPointer(event.pointerId)}
          >
            {activeMedia?.type === "video" ? (
              <video className="h-4/5 w-4/5" controls src={activeMedia.url} aria-label={product.name.en}>
                <track kind="captions" />
              </video>
            ) : (
              <ProductIllustration product={{ ...product, imagePath: activeMedia?.url ?? product.imagePath }} />
            )}
          </div>

          {media.length > 1 && (
            <div
              className="flex items-center justify-center gap-2"
              data-testid="product-media-dots"
            >
              {media.map((item, index) => (
                <button
                  key={`dot-${item.type}-${item.url}-${index}`}
                  type="button"
                  onClick={() => setActiveMediaIndex(index)}
                  aria-label={mediaDotLabelTemplate.replace("{index}", String(index + 1))}
                  aria-current={activeMediaIndex === index}
                  className={`size-2.5 rounded-full border border-accent transition-colors duration-300 ${
                    activeMediaIndex === index ? "bg-accent" : "bg-transparent"
                  }`}
                />
              ))}
            </div>
          )}

          <div
            className="grid grid-cols-4 gap-4 sm:gap-4"
            data-testid="product-media-thumbs"
            onPointerDown={onMediaPointerDown}
            onPointerUp={onMediaPointerUp}
            onPointerCancel={(event) => clearMediaPointer(event.pointerId)}
          >
            {(media.length ? media : [{ type: "image" as const, url: product.imagePath }]).map((item, index) => (
              <button
                key={`${item.type}-${item.url}-${index}`}
                type="button"
                className="bg-surface transition-transform hover:border-warm data-[active=true]:scale-105"
                data-active={activeMediaIndex === index}
                aria-label={`view ${index + 1}`}
                onClick={() => setActiveMediaIndex(index)}
              >
                {item.type === "video" ? (
                  <video src={item.url} aria-label={`${product.name.en} video ${index + 1}`}>
                    <track kind="captions" />
                  </video>
                ) : (
                  <ProductIllustration product={{ ...product, imagePath: item.url }} />
                )}
              </button>
            ))}
          </div>
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

          <div className="grid sm:grid-cols-[1fr_1fr_auto_auto]">
            <button className="btn btn--primary btn--block" onClick={addToCart} disabled={isOutOfStock}>
              {added ? dict.common.added : dict.common.addToCart}
            </button>
            <button className="btn btn--ghost btn--block" onClick={buyNow} disabled={isOutOfStock}>
              {dict.common.buyNow}
            </button>
            <div className="relative grid">
              <button className="btn btn--soft" onClick={onShare} aria-label={dict.common.share}>
                <Icon.Share />
              </button>
              {linkCopied && (
                <div className="pointer-events-none absolute -top-9 inset-x-0 flex justify-center">
                  <span
                    role="status"
                    className="whitespace-nowrap rounded-(--radius-pill) bg-ink px-3 py-1.5 text-xs font-medium text-canvas"
                  >
                    {dict.common.linkCopied}
                  </span>
                </div>
              )}
            </div>
            <button className="btn btn--soft" onClick={onWish} aria-label={dict.common.addToWishlist}>
              {wishlist.has("product", product.id) ? <Icon.HeartFill /> : <Icon.Heart />}
            </button>
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
      <RelatedItems items={relatedItems} lang={lang} title={dict.product?.related} />
    </>
  );
}
