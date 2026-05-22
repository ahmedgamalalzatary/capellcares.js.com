"use client";

import Link from "next/link";
import type { Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";

export function Footer({ lang, dict }: { lang: Language; dict: any }) {
  const year = new Date().getFullYear();
  const isAr = lang === "ar";

  return (
    <footer className="mt-24 bg-(--ink) pt-20 pb-8 text-(--canvas)">
      <div className="container">
        <div className="grid gap-12 md:grid-cols-2 xl:grid-cols-[1.7fr_1fr_1fr_1fr] xl:gap-16">
          <div className="md:col-span-2 xl:col-span-1">
            <div className="inline-flex items-center gap-2.5">
              <span className={isAr ? "text-[34px] font-bold font-(--font-ar)" : "text-[36px] italic font-(--font-display)"}>
                {dict.brand}
              </span>
            </div>
            <p className="mt-5 max-w-[38ch] text-[15px] leading-[1.7] text-[color-mix(in_oklch,var(--canvas)_82%,var(--ink))]">
              {dict.tagline}
            </p>

            <div className="mt-7">
              <div className={`mb-3 text-[11px] tracking-[0.22em] text-(--warm) ${isAr ? "" : "uppercase"}`}>
                {isAr ? "اشتركي في النشرة" : "Join the journal"}
              </div>
              <form className="flex max-w-[420px] items-center gap-1 rounded-(--radius-pill) border border-[color-mix(in_oklch,var(--canvas)_24%,transparent)] bg-[color-mix(in_oklch,var(--canvas)_8%,transparent)] p-1.5" onSubmit={(e) => e.preventDefault()}>
                <input
                  type="email"
                  placeholder={isAr ? "بريدك الإلكتروني" : "Email address"}
                  className="h-10 min-w-0 flex-1 border-0 bg-transparent px-4 text-(--canvas) outline-none placeholder:text-[color-mix(in_oklch,var(--canvas)_56%,transparent)]"
                  aria-label={isAr ? "بريدك الإلكتروني" : "Email address"}
                />
                <button className="h-10 rounded-(--radius-pill) bg-(--accent) px-5 text-[13px] font-medium text-(--canvas) transition-colors hover:bg-(--accent-deep)" type="submit">
                  {isAr ? "اشتركي" : "Subscribe"}
                </button>
              </form>
            </div>
          </div>

          <FooterCol title={isAr ? "تسوّقي" : "Shop"} lang={lang}>
            <FooterLink href={`/${lang}/products`}>{dict.nav.products}</FooterLink>
            <FooterLink href={`/${lang}/offers`}>{dict.nav.offers}</FooterLink>
            <FooterLink href={`/${lang}/category/skin-care`}>{isAr ? "العناية بالبشرة" : "Skin Care"}</FooterLink>
            <FooterLink href={`/${lang}/category/hair-care`}>{isAr ? "العناية بالشعر" : "Hair Care"}</FooterLink>
            <FooterLink href={`/${lang}/category/fragrances`}>{isAr ? "العطور" : "Fragrances"}</FooterLink>
            <FooterLink href={`/${lang}/category/organic-oils`}>{isAr ? "الزيوت العضوية" : "Organic Oils"}</FooterLink>
          </FooterCol>

          <FooterCol title={isAr ? "كابيلا" : "Capella"} lang={lang}>
            <FooterLink as="span">{isAr ? "قصّتنا" : "Our story"}</FooterLink>
            <FooterLink as="span">{isAr ? "المكوّنات" : "Ingredients"}</FooterLink>
            <FooterLink as="span">{isAr ? "الفروع" : "Branches"}</FooterLink>
            <FooterLink as="span">{isAr ? "تواصلي معنا" : "Contact"}</FooterLink>
          </FooterCol>

          <FooterCol title={isAr ? "الحساب" : "Account"} lang={lang}>
            <FooterLink href={`/${lang}/login`}>{dict.nav.login}</FooterLink>
            <FooterLink href={`/${lang}/signup`}>{dict.nav.signup}</FooterLink>
            <FooterLink href={`/${lang}/orders`}>{dict.nav.orders}</FooterLink>
            <FooterLink href={`/${lang}/wishlist`}>{dict.nav.wishlist}</FooterLink>
            <FooterLink href={`/${lang}/cart`}>{dict.nav.cart}</FooterLink>
          </FooterCol>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-3 border-t border-[color-mix(in_oklch,var(--canvas)_18%,transparent)] pt-6 text-[13px] text-[color-mix(in_oklch,var(--canvas)_70%,transparent)] sm:flex-row sm:items-center">
          <span>© {year} {dict.brand}. {isAr ? "كل الحقوق محفوظة." : "All rights reserved."}</span>
          <span className="flex items-center gap-4 text-[12px] text-[color-mix(in_oklch,var(--canvas)_58%,transparent)]">
            <span>{isAr ? "العملة: جنيه مصري" : "Currency: EGP"}</span>
            <span aria-hidden>·</span>
            <span>{isAr ? "صُنع في مصر" : "Made in Egypt"}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, lang, children }: { title: string; lang: Language; children: React.ReactNode }) {
  return (
    <div>
      <div className={`mb-4 text-[11px] tracking-[0.22em] text-(--warm) ${lang === "ar" ? "" : "uppercase"}`}>
        {title}
      </div>
      <div className="grid gap-1.5">{children}</div>
    </div>
  );
}

function FooterLink({ href, as, children }: { href?: string; as?: "span"; children: React.ReactNode }) {
  const cls = "block text-[14px] text-[color-mix(in_oklch,var(--canvas)_82%,var(--ink))] transition-colors hover:text-(--warm)";
  if (as === "span" || !href) return <span className={cls}>{children}</span>;
  return <Link className={cls} href={href}>{children}</Link>;
}
