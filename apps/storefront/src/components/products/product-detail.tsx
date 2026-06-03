"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { pickLang, formatPrice, getProductBadgeState, type Language, type Product, type Offer, type RelatedItemCard } from "@capella/shared";
import { RelatedItems } from "@/components/products/related-items";
import { ProductIllustration } from "@/components/ui/product-illustration";
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
  relatedItems?: RelatedItemCard[];
}

export function ProductDetail({ product, offers, lang, dict, relatedItems = [] }: Props) {
  const router = useRouter();
  const cart = useCart();
  const wishlist = useWishlist();
  const auth = useAuth();
  const { isNew, isBestseller } = getProductBadgeState(product);

  const inStockVariants = product.variants.filter((variant) => variant.stock > 0);
  const [variantId, setVariantId] = useState<number>(inStockVariants[0]?.id ?? product.variants[0].id);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<Tab>("description");
  const [added, setAdded] = useState(false);
  const media = useMemo(
    () => (product.media?.length ? product.media : product.imagePath ? [{ type: "image" as const, url: product.imagePath }] : []),
    [product.media, product.imagePath]
  );
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const activeMedia = media[activeMediaIndex] ?? media[0] ?? null;

  const variant = useMemo(() => product.variants.find((item) => item.id === variantId)!, [variantId, product.variants]);
  const isOutOfStock = variant.stock === 0;

  const addToCart = () => {
    cart.add({ type: "product", productId: product.id, variantId: variant.id, qty });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const buyNow = () => {
    cart.add({ type: "product", productId: product.id, variantId: variant.id, qty });
    router.push(`/${lang}/checkout`);
  };

  const onWish = () => {
    if (!auth.user) {
      router.push(`/${lang}/wishlist`);
      return;
    }
    wishlist.toggle(product.id);
  };

  const tabs: { key: Tab; label: string; content: string }[] = [
    { key: "description", label: dict.product.description, content: pickLang(product.description, lang) },
    { key: "ingredients", label: dict.product.ingredients, content: pickLang(product.ingredients, lang) },
    { key: "howToUse", label: dict.product.howToUse, content: pickLang(product.howToUse, lang) },
    { key: "warnings", label: dict.product.warnings, content: pickLang(product.warnings, lang) }
  ];

  return (
    <>
    <div className="grid gap-6 py-2 sm:gap-8 sm:py-4 lg:grid-cols-[1.1fr_1fr] lg:gap-[60px]">
      <div className="grid gap-3 self-start sm:gap-4 lg:sticky lg:top-[140px]">
        <div className="relative grid aspect-4/5 place-items-center overflow-hidden rounded-(--radius-lg) border border-(--hairline) bg-[radial-gradient(120%_120%_at_50%_0%,var(--surface),var(--warm-soft))] sm:rounded-(--radius-xl)">
          {activeMedia?.type === "video" ? (
            <video className="h-4/5 w-4/5" controls src={activeMedia.url} aria-label={product.name.en} />
          ) : (
            <ProductIllustration product={{ ...product, imagePath: activeMedia?.url ?? product.imagePath }} className="h-4/5 w-4/5" />
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {(media.length ? media : [{ type: "image" as const, url: product.imagePath }]).map((item, index) => (
            <button
              key={`${item.type}-${item.url}-${index}`}
              type="button"
              className="aspect-square rounded-(--radius) border border-(--hairline) bg-(--surface) p-2 transition-colors hover:border-(--warm) data-[active=true]:border-(--accent)"
              data-active={activeMediaIndex === index}
              aria-label={`view ${index + 1}`}
              onClick={() => setActiveMediaIndex(index)}
            >
              {item.type === "video" ? (
                <video src={item.url} aria-label={`${product.name.en} video ${index + 1}`} />
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
            ? "m-0 text-[clamp(30px,3.4vw,46px)] font-bold font-(--font-ar) leading-[1.2] tracking-normal text-(--ink)"
            : "m-0 text-[clamp(32px,3.4vw,48px)] italic font-(--font-display) leading-[1.05] tracking-[-0.01em] text-(--ink)"}>
            {pickLang(product.name, lang)}
          </h1>
          {(isNew || isBestseller || offers.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {isNew && <span className="badge badge--new">{dict.badges.new}</span>}
              {isBestseller && <span className="badge badge--gold">{dict.badges.bestseller}</span>}
              {offers.map((offer) => (
                <Link key={offer.id} href={`/${lang}/offers/${offer.slug}`} className="badge badge--offer">
                  ★ {pickLang(offer.name, lang)}
                </Link>
              ))}
            </div>
          )}
        </div>

        <p className="max-w-[60ch] text-[15px] leading-[1.75] text-(--ink-2)">{pickLang(product.description, lang)}</p>

        <div className="flex flex-wrap items-end gap-3 border-y border-(--hairline) py-4 sm:py-5">
          <span className={lang === "ar"
            ? "text-[30px] font-bold font-(--font-ar) leading-none text-(--accent) sm:text-[36px]"
            : "text-[32px] italic font-(--font-display) leading-none text-(--accent) sm:text-[40px]"}>
            {formatPrice(variant.price, lang)}
          </span>
          {isOutOfStock ? (
            <span className="chip chip--accent">{dict.common.outOfStock}</span>
          ) : variant.stock <= 5 ? (
            <span className="chip chip--gold">{dict.common.lowStock.replace("{n}", String(variant.stock))}</span>
          ) : (
            <span className="chip chip--sage">{dict.common.inStock}</span>
          )}
        </div>

        <div className="grid gap-2">
          <div className="eyebrow !text-(--ink-3) !opacity-100">
            {dict.product.selectSize}
          </div>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((item) => (
              <button
                key={item.id}
                className={[
                  "grid min-w-[112px] gap-0.5 rounded-(--radius) border px-4 py-3 text-start transition-colors",
                  item.stock > 0 ? "hover:border-(--warm) hover:bg-(--warm-soft)" : "cursor-not-allowed opacity-45 line-through",
                  variantId === item.id ? "border-(--accent) bg-(--accent-soft) text-(--ink)" : "border-(--hairline) bg-(--surface) text-(--ink-2)"
                ].join(" ")}
                data-active={variantId === item.id}
                data-out={item.stock === 0 ? "true" : undefined}
                onClick={() => item.stock > 0 && setVariantId(item.id)}
                disabled={item.stock === 0}
              >
                <span className="text-[14px] font-medium">{item.size}</span>
                <span className="text-[12px] opacity-80">{formatPrice(item.price, lang)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <div className="eyebrow !text-(--ink-3) !opacity-100">
            {dict.common.quantity}
          </div>
          <div className="inline-grid grid-cols-[40px_64px_40px] items-center rounded-(--radius-pill) border border-(--hairline) bg-(--surface)">
            <button
              className="grid h-11 place-items-center border-0 bg-transparent text-(--ink-2) transition-colors hover:text-(--ink) disabled:opacity-30"
              onClick={() => setQty((value) => Math.max(1, value - 1))}
              aria-label="−"
              disabled={qty <= 1}
            >
              <Icon.Minus />
            </button>
            <span className="text-center text-[15px] font-semibold text-(--ink)">{qty}</span>
            <button
              className="grid h-11 place-items-center border-0 bg-transparent text-(--ink-2) transition-colors hover:text-(--ink) disabled:opacity-30"
              onClick={() => setQty((value) => Math.min(variant.stock || 1, value + 1))}
              aria-label="+"
              disabled={qty >= variant.stock}
            >
              <Icon.Plus />
            </button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <button className="btn btn--primary btn--block" onClick={addToCart} disabled={isOutOfStock}>
            <Icon.Cart size={18} />
            {added ? (lang === "ar" ? "أُضيف" : "Added") : dict.common.addToCart}
          </button>
          <button className="btn btn--ghost btn--block" onClick={buyNow} disabled={isOutOfStock}>
            {dict.common.buyNow}
          </button>
          <button className="btn btn--soft" onClick={onWish} aria-label={dict.common.addToWishlist}>
            {wishlist.has(product.id) ? <Icon.HeartFill /> : <Icon.Heart />}
          </button>
        </div>

        <div className="-mx-4 overflow-x-auto border-b border-(--hairline) px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-1">
            {tabs.map((item) => {
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  className={[
                    "relative mx-0 me-2 shrink-0 whitespace-nowrap border-0 bg-transparent px-1.5 py-3.5 text-[14px] transition-colors",
                    active ? "text-(--ink) font-semibold" : "text-(--ink-3) hover:text-(--ink-2)"
                  ].join(" ")}
                  data-active={active}
                  onClick={() => setTab(item.key)}
                >
                  {item.label}
                  {active && <span className="absolute inset-x-0 -bottom-px h-[2px] bg-(--accent)" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-20 max-w-[65ch] text-[15px] leading-[1.85] text-(--ink-2)">
          {tabs.find((item) => item.key === tab)?.content}
        </div>
      </div>
    </div>
    <RelatedItems items={relatedItems} lang={lang} title={dict.product?.related} />
    </>
  );
}
