"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { pickLang, type Collection, type Language, type Offer, type Product } from "@capella/shared";
import { fetchCollections, fetchOffers, fetchProducts } from "@/lib/api/client";
import { ProductCard } from "@/components/products/product-card";
import { SectionCard } from "@/components/shop/section-card";
import { ShopCardRow } from "@/components/shop/shop-card-row";
import { ColumnsToggle, type Cols } from "@/components/ui/columns-toggle";
import { Icon } from "@/components/ui/icons";
import { authHref } from "@/lib/auth-redirect";

/** Row order for the mixed wishlist: offers, then collections, then products. */
const KIND_RANK = { offer: 0, collection: 1, product: 2 } as const;

function EmptyShell({ isAr, icon, title, desc, ctaHref, ctaLabel }: {
  isAr: boolean; icon: React.ReactNode; title: string; desc: string; ctaHref: string; ctaLabel: string;
}) {
  return (
    <div className="mx-auto my-10 grid max-w-120 place-items-center gap-4 rounded-lg border border-(--hairline) bg-surface px-6 py-12 text-center sm:my-16 sm:px-8 sm:py-14">
      <div className="grid h-19 w-19 place-items-center bg-(--accent-soft) text-accent">
        {icon}
      </div>
      <h2 className={`m-0 leading-[1.1] ${isAr
        ? "text-2xl font-bold font-(family-name:--font-ar) text-ink"
        : "text-3xl font-(--font-display) text-ink"}`}>
        {title}
      </h2>
      <p className="max-w-[44ch] text-sm leading-[1.7] text-(--ink-2)">{desc}</p>
      <Link href={ctaHref} className="btn btn--primary mt-1">{ctaLabel}</Link>
    </div>
  );
}

/** Shop-page section header: title on the start side, count + controls on the end. */
function RowHeader({ isAr, title, count, children }: {
  isAr: boolean; title: string; count: number; children?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex items-end justify-between gap-4">
      <h2 className={isAr
        ? "m-0 text-[clamp(20px,2vw,28px)] font-bold font-(family-name:--font-ar) leading-[1.15] text-ink"
        : "m-0 text-[clamp(20px,2vw,28px)] font-(--font-display) leading-[1.1] tracking-[-0.005em] text-ink"}>
        {title}
      </h2>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm text-(--ink-3)">{count}</span>
        {children}
      </div>
    </header>
  );
}

export function WishlistView({ lang, dict }: { lang: Language; dict: any }) {
  const { user } = useAuth();
  const { items, remove } = useWishlist();
  const isAr = lang === "ar";
  // POV control: 1 = roomy cards, 2 = one extra card per screen in the row.
  const [cols, setCols] = useState<Cols>(2);

  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  // Categories are deliberately not fetched: product cards on this page render
  // without their category line, so there is nothing to look a name up for.
  // Same guard as the cart: the wishlist entries are the source of truth, the
  // catalog fetch only upgrades them to full cards. Until it lands we must not
  // render "nothing saved" over a wishlist that actually has entries.
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([fetchProducts(), fetchOffers(), fetchCollections()])
      .then(([p, o, c]) => {
        if (cancelled) return;
        setProducts(p);
        setOffers(o);
        setCollections(c);
        setCatalogLoaded(true);
      })
      .catch(() => {
        // Open the gate on failure too, otherwise the page is stuck on the
        // loading state forever. With no catalog every entry falls through to
        // `orphans`, so the customer still sees what they saved as unavailable
        // rows and can remove them — degraded, but not a dead page.
        if (cancelled) return;
        setCatalogLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // One mixed row: offers first, then collections, then products. Within each
  // kind the wishlist's own order (oldest saved first) is preserved.
  const saved = useMemo(
    () => items
      .map((item) => {
        if (item.entityType === "product") {
          const product = products.find((p) => p.id === item.entityId);
          return product ? { kind: "product" as const, entry: item, data: product } : null;
        }
        if (item.entityType === "offer") {
          const offer = offers.find((o) => o.id === item.entityId);
          return offer ? { kind: "offer" as const, entry: item, data: offer } : null;
        }
        const collection = collections.find((c) => c.id === item.entityId);
        return collection ? { kind: "collection" as const, entry: item, data: collection } : null;
      })
      .filter((entry) => entry != null)
      // Stable sort keeps the saved order inside each kind.
      .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind]),
    [items, products, offers, collections]
  );

  // Entries whose target is gone from the catalog (deleted, hidden, or out of
  // publication). They still occupy a wishlist slot, so they get a minimal card
  // whose only job is letting the customer clear them.
  const orphans = useMemo(() => {
    const resolvedIds = new Set(saved.map((entry) => `${entry.entry.entityType}:${entry.entry.entityId}`));
    return items.filter((item) => !resolvedIds.has(`${item.entityType}:${item.entityId}`));
  }, [items, saved]);

  // Page head, rendered by this view (not the shared shell) so the POV toggle
  // can sit beside the title. The toggle only appears once there are cards.
  const head = (
    <header className="page-head">
      <div className="flex items-center justify-between gap-4">
        <h1>{dict.wishlist.title}</h1>
        {saved.length > 0 ? (
          <div className="shrink-0">
            <ColumnsToggle cols={cols} onChange={setCols} lang={lang} />
          </div>
        ) : null}
      </div>
    </header>
  );

  if (!user) {
    return (
      <>
        {head}
        <EmptyShell
          isAr={isAr}
          icon={<Icon.Heart size={32} />}
          title={dict.wishlist.loginRequired}
          desc={dict.wishlist.loginRequiredDesc}
          ctaHref={authHref("login", lang, `/${lang}/wishlist`)}
          ctaLabel={dict.wishlist.goLogin}
        />
      </>
    );
  }

  if (items.length > 0 && !catalogLoaded) {
    return (
      <>
        {head}
        <div className="mx-auto my-10 grid max-w-115 place-items-center gap-4 px-6 py-12 text-center sm:my-16">
          <div className="grid h-16 w-16 animate-pulse place-items-center rounded-full bg-(--accent-soft) text-accent">
            <Icon.Heart size={26} />
          </div>
          <p className="text-sm text-(--ink-2)">{dict.common?.loading ?? "…"}</p>
        </div>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        {head}
        <EmptyShell
          isAr={isAr}
          icon={<Icon.Heart size={32} />}
          title={dict.wishlist.empty}
          desc={dict.wishlist.savedEmpty}
          ctaHref={`/${lang}/products`}
          ctaLabel={dict.cart.keepShopping}
        />
      </>
    );
  }

  return (
    <>
      {head}
      {/* min-w-0 all the way down: without it a grid/flex item sizes to its
          content's min-content width, so the card row stretches the page instead
          of scrolling inside it — which is what blew the cards past the viewport. */}
      <div className="grid min-w-0 gap-10 pb-8 sm:gap-12">
        {saved.length > 0 && (
          <section className="min-w-0">
            <ShopCardRow lang={lang} cols={cols}>
              {saved.map((entry) =>
                entry.kind === "product" ? (
                  // No categoryName here on purpose: the wishlist row stays compact,
                  // so product cards skip the category line.
                  <ProductCard
                    key={`product:${entry.data.id}`}
                    product={entry.data}
                    lang={lang}
                    dict={dict}
                  />
                ) : entry.kind === "offer" ? (
                  <SectionCard key={`offer:${entry.data.id}`} kind="offer" data={entry.data} lang={lang} dict={dict} />
                ) : (
                  <SectionCard key={`collection:${entry.data.id}`} kind="collection" data={entry.data} lang={lang} dict={dict} />
                )
              )}
            </ShopCardRow>
          </section>
        )}

        {orphans.length > 0 && (
          <section className="min-w-0">
            <RowHeader isAr={isAr} title={dict.common.outOfStock ?? "Unavailable"} count={orphans.length} />
            <ul className="grid list-none gap-2 p-0 m-0">
              {orphans.map((item) => (
                <li
                  key={`${item.entityType}:${item.entityId}`}
                  className="flex items-center gap-3 rounded-(--radius) border border-(--hairline) bg-surface p-3"
                >
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-(--warm-soft) text-(--ink-3)">
                    {item.imagePath ? (
                      <img src={item.imagePath} alt={pickLang(item.name, lang)} className="block h-full w-full object-cover" />
                    ) : (
                      <Icon.Heart size={20} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">{pickLang(item.name, lang)}</div>
                    <div className="mt-0.5 text-sm text-(--ink-3)">
                      {dict.wishlist.itemTypes?.[item.entityType] ?? item.entityType}
                    </div>
                  </div>
                  <button
                    className="ms-auto grid h-9 w-9 shrink-0 place-items-center rounded-(--radius) border-0 bg-transparent text-(--ink-3) transition-colors hover:bg-[color-mix(in_oklch,var(--error)_10%,transparent)] hover:text-(--error)"
                    onClick={() => remove(item.entityType, item.entityId)}
                    aria-label={dict.common.removeFromWishlist}
                    title={dict.common.removeFromWishlist}
                  >
                    <Icon.Trash size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
