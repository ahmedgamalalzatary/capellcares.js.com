"use client";

import Link from "next/link";
import type { Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";

export function Footer({ lang, dict }: { lang: Language; dict: any }) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 bg-[linear-gradient(180deg,transparent,var(--bg-tint)_30%)] pb-6 pt-16">
      <div className="container">
        <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_1fr] xl:gap-12">
          <div className="md:col-span-2 xl:col-span-1">
            <div className="inline-flex items-center gap-2.5">
              <Icon.Logo size={36} />
              <span className="text-[22px] font-(--font-display)">{dict.brand}</span>
            </div>
            <p className="mt-4 max-w-[36ch] text-(--ink-2)">{dict.tagline}</p>

            <form className="mt-4 flex max-w-[380px] gap-2 rounded-full border border-(--hairline) bg-white p-1.5" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder={lang === "ar" ? "بريدك الإلكتروني" : "Email address"}
                className="h-9 min-w-0 flex-1 border-0 bg-transparent px-4 outline-none"
                aria-label={lang === "ar" ? "بريدك الإلكتروني" : "Email address"}
              />
              <button className="btn btn--primary btn--sm" type="submit">
                {lang === "ar" ? "اشترك" : "Subscribe"}
              </button>
            </form>
          </div>

          <div>
            <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-(--ink-3)">
              {lang === "ar" ? "تسوقي" : "Shop"}
            </div>
            <Link className="block py-1 text-[14px] text-(--ink-2) hover:text-accent" href={`/${lang}/products`}>{dict.nav.products}</Link>
            <Link className="block py-1 text-[14px] text-(--ink-2) hover:text-accent" href={`/${lang}/offers`}>{dict.nav.offers}</Link>
            <Link className="block py-1 text-[14px] text-(--ink-2) hover:text-accent" href={`/${lang}/category/skin-care`}>{lang === "ar" ? "العناية بالبشرة" : "Skin Care"}</Link>
            <Link className="block py-1 text-[14px] text-(--ink-2) hover:text-accent" href={`/${lang}/category/hair-care`}>{lang === "ar" ? "العناية بالشعر" : "Hair Care"}</Link>
            <Link className="block py-1 text-[14px] text-(--ink-2) hover:text-accent" href={`/${lang}/category/fragrances`}>{lang === "ar" ? "العطور" : "Fragrances"}</Link>
          </div>

          <div>
            <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-(--ink-3)">
              {lang === "ar" ? "كابيلا" : "Capella"}
            </div>
            <span className="block py-1 text-[14px] text-(--ink-2)">{lang === "ar" ? "قصتنا" : "Our story"}</span>
            <span className="block py-1 text-[14px] text-(--ink-2)">{lang === "ar" ? "الفروع" : "Branches"}</span>
            <span className="block py-1 text-[14px] text-(--ink-2)">{lang === "ar" ? "تواصلي معنا" : "Contact"}</span>
          </div>

          <div>
            <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-(--ink-3)">
              {lang === "ar" ? "الحساب" : "Account"}
            </div>
            <Link className="block py-1 text-[14px] text-(--ink-2) hover:text-accent" href={`/${lang}/login`}>{dict.nav.login}</Link>
            <Link className="block py-1 text-[14px] text-(--ink-2) hover:text-accent" href={`/${lang}/signup`}>{dict.nav.signup}</Link>
            <Link className="block py-1 text-[14px] text-(--ink-2) hover:text-accent" href={`/${lang}/cart`}>{dict.nav.cart}</Link>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-between gap-3 border-t border-(--hairline) pt-4 text-[13px] text-(--ink-2)">
          <span>© {year} {dict.brand}. {lang === "ar" ? "كل الحقوق محفوظة." : "All rights reserved."}</span>
          <span className="text-[12px] text-(--ink-3)">
            {lang === "ar" ? "العملة: جنيه مصري" : "Currency: EGP"}
          </span>
        </div>
      </div>
    </footer>
  );
}

