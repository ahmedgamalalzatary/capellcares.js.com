"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { pickLang, type Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";

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

export function WishlistView({ lang, dict }: { lang: Language; dict: any }) {
  const { user } = useAuth();
  const { items, remove } = useWishlist();
  const isAr = lang === "ar";

  if (!user) {
    return (
      <EmptyShell
        isAr={isAr}
        icon={<Icon.Heart size={32} />}
        title={dict.wishlist.loginRequired}
        desc={dict.wishlist.loginRequiredDesc}
        ctaHref={`/${lang}/login`}
        ctaLabel={dict.wishlist.goLogin}
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyShell
        isAr={isAr}
        icon={<Icon.Heart size={32} />}
        title={dict.wishlist.empty}
        desc={dict.wishlist.savedEmpty}
        ctaHref={`/${lang}/products`}
        ctaLabel={dict.cart.keepShopping}
      />
    );
  }

  return (
    <div className="grid gap-4 pb-8 sm:gap-6 sm:pb-8">
      {items.map((item) => (
        <article
          key={`${item.entityType}:${item.entityId}`}
          className="grid gap-4 rounded-lg border border-(--hairline) bg-surface p-4 sm:grid-cols-[112px_1fr_auto] sm:items-center"
        >
          <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-md bg-(--warm-soft)">
            {item.imagePath ? (
              <img src={item.imagePath} alt={pickLang(item.name, lang)} className="h-full w-full object-cover" />
            ) : (
              <Icon.Heart size={24} />
            )}
          </div>
          <div className="grid gap-2">
            <div className="text-xs uppercase tracking-[0.14em] text-(--ink-3)">
              {dict.wishlist.itemTypes?.[item.entityType] ?? item.entityType}
            </div>
            {item.href ? (
              <Link href={`/${lang}${item.href}`} className="text-lg font-semibold text-ink">
                {pickLang(item.name, lang)}
              </Link>
            ) : (
              <div className="text-lg font-semibold text-ink">{pickLang(item.name, lang)}</div>
            )}
            {item.availability === "unavailable" ? (
              <span className="chip chip--muted">{dict.common.outOfStock ?? "Unavailable"}</span>
            ) : null}
          </div>
          <button
            className="btn btn--ghost btn--sm justify-self-start sm:justify-self-end"
            onClick={() => remove(item.entityType, item.entityId)}
            aria-label={dict.common.removeFromWishlist}
          >
            {dict.common.removeFromWishlist}
          </button>
        </article>
      ))}
    </div>
  );
}
